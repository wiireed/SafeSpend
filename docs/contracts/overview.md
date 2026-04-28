# Overview — what lives where, and why

SafeSpend's on-chain layer is two contracts and one rule:

> The agent never holds the funds. The vault holds the funds, the user sets the policy, and the vault decides whether each spend is allowed.

That's the whole idea. Everything else in this doc explains how that idea is encoded in 272 lines of Solidity, what it costs to enforce, and where the seams are between on-chain truth and off-chain convenience.

## The two contracts

### `PolicyVault` ([`packages/contracts/src/PolicyVault.sol`](../../packages/contracts/src/PolicyVault.sol))

The policy engine. One vault per deployment, many users, one policy per user. It:

- Holds the deposited USDC (`usdc.balanceOf(vault)` is the sum of all users' unspent deposits).
- Stores each user's `Policy` struct: `maxPerTx`, `maxTotal`, `expiresAt`, `authorizedAgent`, `version`, `allowedMerchants[]`.
- Tracks per-user `deposited` and `spent` running totals, so policy resets do not reset the spent counter.
- Exposes `proposePurchase` (strict: revert on any failure) and `tryProposePurchase` (observable: emit a `PurchaseRejected` event with a typed reason instead of reverting).
- Emits `PurchaseApproved` with the policy version that authorised the spend, so the audit trail can prove which exact policy a spend was made under.

The vault is **immutable** in the sense that there is no admin, no owner, no upgrade proxy, no pause switch. The only privileged action a user can take on their own state is `setPolicy` (replace your own policy) and `withdraw` (pull back your own unspent deposit).

### `MockUSDC` ([`packages/contracts/src/MockUSDC.sol`](../../packages/contracts/src/MockUSDC.sol))

A 6-decimal OpenZeppelin ERC-20 with a public `mint(to, amount)`. **Hackathon-only.** On a real deployment you would point the vault at the real USDC address (Circle's). The vault's `usdc` field is `immutable` and set in the constructor — there is no token-swap path.

```solidity
// PolicyVault.sol:13–18
contract PolicyVault {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_ALLOWLIST = 20;

    IERC20 public immutable usdc;
```

## The four roles

| Role | Who | What they can do | What they cannot do |
|---|---|---|---|
| **Depositor / user** | EOA that signs `setPolicy` | Set their own policy, deposit USDC, withdraw their own unspent deposit | Move funds without a policy that allows it; reduce another user's spent counter |
| **Authorised agent** | EOA whose private key the LLM agent is given access to | Call `proposePurchase` / `tryProposePurchase` on behalf of a specific user | Change the policy; deposit on a user's behalf without explicit approval; spend more than the policy permits |
| **Merchant** | EOA on the allowlist (resolved from an ENS name off-chain) | Receive USDC when a purchase is approved | Pull funds; trigger transfers; appear on the allowlist without being added by the user |
| **Anyone (`depositFor`)** | Any EOA | Top up *another* user's vault balance, provided that user already has a policy | Set, modify, or read any other user's policy beyond what the public getters expose |

The whole design hinges on roles 1 and 2 being **different keys**. If you give the agent the depositor's private key, you have no policy and no vault — you have a hot wallet with a chatbot in front of it. The whole point is to keep those keys separate.

## On-chain vs off-chain — where the trust boundary sits

```
   ┌──────────────────────────  off-chain  ──────────────────────────┐
   │                                                                  │
   │  LLM (OpenAI / Anthropic)                                        │
   │      │                                                           │
   │      ▼                                                           │
   │  agent process (TypeScript, viem, holds the agent EOA's key)    │
   │      │                                                           │
   │  ╭───┼──────────  hard input checks (proposePurchase.ts)  ────╮  │
   │  │   │  amount is positive decimal string, < 2^256           │  │
   │  │   │  merchant is hex address or .eth ENS name (resolved)  │  │
   │  │   │  listingId non-empty                                  │  │
   │  ╰───┼─────────────────────────────────────────────────────────╯  │
   │      │                                                           │
   └──────┼─────────────────  trust boundary  ─────────────────────────┘
          │
          ▼
   ┌──────────────────────────   on-chain   ─────────────────────────┐
   │  PolicyVault.tryProposePurchase                                  │
   │     msg.sender == policy.authorizedAgent  ── revert if not       │
   │     block.timestamp <= policy.expiresAt   ── reject if not       │
   │     merchant in allowedMerchants          ── reject if not       │
   │     amount <= maxPerTx                    ── reject if not       │
   │     spent + amount <= maxTotal            ── reject if not       │
   │     spent + amount <= deposited           ── reject if not       │
   │     ──────────────────────────────────────                       │
   │     spent += amount; emit Approved; usdc.safeTransfer(merchant)  │
   └──────────────────────────────────────────────────────────────────┘
```

The key claim is: **everything below the trust boundary is enforced regardless of how the agent is prompted, configured, or compromised.** The off-chain checks in `proposePurchase.ts` exist to give cleaner error messages to the LLM transcript; the same checks (or stronger ones) are enforced on-chain. If the agent skipped its input checks, the vault would still reject anything the policy didn't permit.

The off-chain layer **adds convenience** — ENS resolution, listing IDs, JSON envelopes for the LLM — but does not **subtract** any guarantee. Removing the agent's input checks would make the demo log uglier; it would not make any extra spend possible.

## Anatomy of a purchase

Here is the lifecycle of a single safe-mode purchase, bottom-up. Call this the "happy path"; the rejected paths are the same right up to `_validate` returning a non-`Ok` value.

### 1. The user sets a policy ([`PolicyVault.sol:97`](../../packages/contracts/src/PolicyVault.sol))

```solidity
function setPolicy(PolicyInput calldata input) external {
    if (input.allowedMerchants.length > MAX_ALLOWLIST) revert AllowlistTooLong();

    Policy storage p = _policies[msg.sender];
    p.maxPerTx = input.maxPerTx;
    p.maxTotal = input.maxTotal;
    p.expiresAt = input.expiresAt;
    p.authorizedAgent = input.authorizedAgent;
    p.version += 1;

    delete p.allowedMerchants;
    for (uint256 i = 0; i < input.allowedMerchants.length; i++) {
        p.allowedMerchants.push(input.allowedMerchants[i]);
    }

    emit PolicySet(msg.sender, p.version, ...);
}
```

`msg.sender` is the policy's owner, period. There is no "set policy on behalf of"; the user signs the transaction themselves. The version is **monotonic** — bumped on every replacement, never reset. Allowlists are capped at `MAX_ALLOWLIST = 20` to bound the gas of the linear scan in `_isAllowed`.

The previous allowlist is `delete`d, then refilled from the input. Replacing a policy fully replaces it; the version bump is the audit signal.

The user's `spent` counter is **deliberately not reset** on policy replacement. Test 2 (`test_SetPolicy_FullyReplacesPrior_DoesNotResetSpent`) pins this. The reason is that an attacker who somehow induced a policy reset cannot wipe the spend history; the `maxTotal` for the new policy is enforced against the existing `spent[user]`.

### 2. The user deposits ([`PolicyVault.sol:143`](../../packages/contracts/src/PolicyVault.sol))

```solidity
function deposit(uint256 amount) external {
    _depositFor(msg.sender, msg.sender, amount);
}

function depositFor(address user, uint256 amount) external {
    _depositFor(user, msg.sender, amount);
}

function _depositFor(address user, address payer, uint256 amount) internal {
    if (_policies[user].version == 0) revert NoPolicy();

    // CEI: state update before external transfer.
    deposited[user] += amount;
    emit Deposited(user, payer, amount);
    usdc.safeTransferFrom(payer, address(this), amount);
}
```

You cannot deposit into a vault slot that has no policy. This avoids accidentally seeding funds before the user has authorised any agent — there is nothing to spend the funds against, and `withdraw` is the only way to get them out. `depositFor` lets a third party (the deploy script, a sponsor, an employer) credit a user's slot without the user's key, but only after the user has signed `setPolicy`.

Both functions follow CEI: storage update first (`deposited[user] += amount`), then the external token transfer. `safeTransferFrom` reverts on any failure, so the storage update is atomic with the transfer.

### 3. The agent proposes ([`PolicyVault.sol:190`](../../packages/contracts/src/PolicyVault.sol))

```solidity
function tryProposePurchase(
    address user,
    address merchant,
    uint256 amount,
    bytes32 listingHash
) external returns (bool ok, string memory reason) {
    Policy storage p = _policies[user];

    if (p.version == 0) {
        string memory r = "no_policy";
        emit PurchaseRejected(user, merchant, amount, listingHash, keccak256(bytes(r)), r);
        return (false, r);
    }

    if (msg.sender != p.authorizedAgent) revert UnauthorizedAgent();

    Reason rEnum = _validate(p, user, merchant, amount);
    if (rEnum == Reason.Ok) {
        _execute(user, merchant, amount, listingHash, p.version);
        return (true, "");
    }

    string memory rStr = _reasonString(rEnum);
    emit PurchaseRejected(user, merchant, amount, listingHash, keccak256(bytes(rStr)), rStr);
    return (false, rStr);
}
```

Note the asymmetry:

- `no_policy` is returned softly (event + return value), because the *caller is allowed to discover* that no policy exists.
- `unauthorized_agent` is a **hard revert**, because the caller is unauthenticated and we don't want to give them a clean event channel to spam.
- Every other failure is also returned softly, because the agent is authenticated and the rejection is a useful, indexable signal in the audit trail.

The strict variant `proposePurchase` reverts on every failure, including the soft ones. The agent and the demo only use `tryProposePurchase`; `proposePurchase` is there for callers (test scripts, future integrations) that want failure to bubble up.

### 4. The vault validates ([`PolicyVault.sol:219`](../../packages/contracts/src/PolicyVault.sol))

```solidity
function _validate(
    Policy storage p,
    address user,
    address merchant,
    uint256 amount
) internal view returns (Reason) {
    if (block.timestamp > p.expiresAt) return Reason.PolicyExpired;
    if (!_isAllowed(p.allowedMerchants, merchant)) return Reason.MerchantNotAllowed;
    if (amount > p.maxPerTx) return Reason.ExceedsPerTx;
    if (spent[user] + amount > p.maxTotal) return Reason.ExceedsTotal;
    if (spent[user] + amount > deposited[user]) return Reason.InsufficientDeposit;
    return Reason.Ok;
}
```

Five checks, in a fixed order. The order matters only for the rejection event — the *first* failing check is the one that's reported. This means a stale allowlist is reported as `policy_expired` (not `merchant_not_allowed`), which is the more accurate root cause from the user's perspective.

For full-detail enforcement see [`guardrails.md`](./guardrails.md).

### 5. The vault executes ([`PolicyVault.sol:233`](../../packages/contracts/src/PolicyVault.sol))

```solidity
function _execute(
    address user,
    address merchant,
    uint256 amount,
    bytes32 listingHash,
    uint64 policyVersion
) internal {
    // CEI: bump spent before the external transfer.
    spent[user] += amount;
    emit PurchaseApproved(user, merchant, amount, listingHash, policyVersion);
    usdc.safeTransfer(merchant, amount);
}
```

CEI again: `spent[user]` is incremented before the external call. Even though `safeTransfer` reverts on failure (so atomicity is preserved either way), the ordering forecloses a class of reentrancy mistakes if the token were ever swapped for a hook-emitting variant.

`policyVersion` is **indexed** in the `PurchaseApproved` event. This is the tamper-evident link between a spend and the exact policy that authorised it: if you replace your policy after a spend happens, your audit trail still tells you the spend went out under v3, not v4.

## What `listingHash` is for

The listing hash is a 32-byte commitment computed off-chain ([`packages/sdk/src/chain.ts:44`](../../packages/sdk/src/chain.ts)):

```ts
keccak256(abi.encode(address merchant, uint256 amount, string listingId))
```

It is **opaque to the contract** — the vault never compares it against anything; it just emits it in the event. Its purpose is downstream:

- A frontend or auditor can compute the same hash from the listing details and grep the event log to find every spend that was made against a specific listing ID.
- It is harder to grief a transcript by reusing event data from one listing to mint a fake "approval" for another listing, because the listing data is committed up-front.

The hash is **not a replay defence**. It does not prevent the agent from buying the same listing twice; that's what `maxPerTx` and `maxTotal` are for.

## What's not on-chain (and why)

Two deliberate design decisions about what does *not* live in the contract:

1. **The merchant allowlist stores addresses, not ENS names.** ENS resolution is mainnet-only and slow, so doing it on-chain on Fuji would be impractical. Off-chain code in [`packages/sdk/src/ens.ts`](../../packages/sdk/src/ens.ts) resolves the name to an address before the vault sees it, and the human-readable name is preserved only in the agent transcript. The on-chain check is `merchant in allowedMerchants[]`, byte-for-byte address equality.

2. **There is no global rate limit, no daily cap, no cool-down.** The policy is a static envelope: per-tx, total, expiry. Within that envelope, the agent can call as fast as it likes. We chose this because the demo runs in a single browser session in <60 seconds and doesn't need rate limiting; a real deployment would layer something on top (a relayer that throttles, a Snap that prompts the user). It would be straightforward to add a `cooldownSeconds` field to the policy struct in v2.

## Deployment topology

```
Anvil (local)        chainId=31337   addresses pinned to deployer nonce 0/1
Avalanche Fuji       chainId=43113   USDC=0x6754…68e8  Vault=0x15b2…34Ba  (Sourcify-verified)
Mainnet              never (hackathon prototype)
```

`packages/contracts/src/addresses.ts` is the source of truth for both. `pnpm fuji:deploy` runs the Foundry deploy script and rewrites the Fuji entry in that file in place.

## Reading order from here

If you came in cold:

1. Skim [`PolicyVault.sol`](../../packages/contracts/src/PolicyVault.sol) end-to-end (10 minutes — it's 272 lines).
2. Read [`guardrails.md`](./guardrails.md) for the rejection matrix and threat model.
3. Read [`PolicyVault.t.sol`](../../packages/contracts/test/PolicyVault.t.sol) and watch the tests pass with `pnpm contracts:test` (about 1 second).
4. If anything in the prose was confusing, [`glossary.md`](./glossary.md) has plain-English definitions of every term.
