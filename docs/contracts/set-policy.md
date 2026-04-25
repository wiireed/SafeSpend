# `setPolicy` — how the spending policy works, in detail

The policy is the trust boundary. Everything else in SafeSpend — the agent, the merchants, the deposits — is just data flowing through the envelope the policy defines. This document is the deep dive on that one function: what each field means, what happens when you call it, what happens when you call it *again*, and what the demo UI is doing on your behalf when you hit "Set policy."

If you only want a one-screen reference, see [`glossary.md`](./glossary.md). If you want to understand the rejection matrix that the policy gates, see [`guardrails.md`](./guardrails.md). This doc fills the middle: the *policy itself*, end-to-end.

## What is "the policy"

A `Policy` is a per-user record stored on the `PolicyVault` contract. There is exactly one slot per user, keyed by `msg.sender` to `setPolicy`. The struct ([`PolicyVault.sol:20–27`](../../contracts/src/PolicyVault.sol)):

```solidity
struct Policy {
    uint256 maxPerTx;            // largest single spend
    uint256 maxTotal;            // lifetime budget cap
    uint256 expiresAt;           // unix timestamp; spends after this are rejected
    address authorizedAgent;     // the one EOA allowed to call (try)proposePurchase
    uint64  version;             // monotonic; bumped on every setPolicy
    address[] allowedMerchants;  // up to 20 addresses; recipients of approved spends
}
```

A *separate* but tightly related struct, `PolicyInput`, is what you pass in. It is the same minus `version` (which the contract assigns):

```solidity
struct PolicyInput {
    uint256 maxPerTx;
    uint256 maxTotal;
    uint256 expiresAt;
    address authorizedAgent;
    address[] allowedMerchants;
}
```

You write a `PolicyInput`, the vault stores a `Policy`. You never set `version` yourself — the contract is the source of truth for monotonicity.

## The five fields, explained

### `maxPerTx` — the per-purchase ceiling

The largest amount the agent can spend in a single `proposePurchase` call. Denominated in **USDC base units**, which means 6 decimals: `100 USDC` is `100_000_000` (or `100 * 1e6`).

```solidity
if (amount > p.maxPerTx) return Reason.ExceedsPerTx;     // PolicyVault.sol:227
```

This is your blast-radius limit per single attack. If a prompt-injection convinces the agent to spend `9_999 USDC` on one purchase, this is the first guard that catches it (assuming a merchant somehow snuck onto the allowlist, which it didn't). The demo's default is `100 USDC`.

### `maxTotal` — the lifetime budget

The cumulative cap across **every spend, ever, across every policy version** for this user.

```solidity
if (spent[user] + amount > p.maxTotal) return Reason.ExceedsTotal;     // PolicyVault.sol:228
```

The subtle thing: `spent[user]` is **not** reset when you call `setPolicy` again. So if you've already spent 200 USDC under v1 and you replace the policy with v2 that has `maxTotal = 300`, you have 100 left to spend, not 300. This is by design — see [test 2](../../contracts/test/PolicyVault.t.sol). The reason is auditability: an attacker who somehow induced a policy reset cannot wipe spend history.

If you want to "reset" the budget, the clean way is to **withdraw and start over with a new vault deposit on a new policy**. (Practically: replace the policy with a higher `maxTotal` if you trust yourself.)

The demo's default is `500 USDC`.

### `expiresAt` — the deadline

Unix timestamp (seconds since 1970-01-01 UTC) after which all `(try)proposePurchase` calls are rejected with `policy_expired`.

```solidity
if (block.timestamp > p.expiresAt) return Reason.PolicyExpired;    // PolicyVault.sol:225
```

A few notes:

- **Withdraws are still allowed past expiry.** [Test 21](../../contracts/test/PolicyVault.t.sol) pins this. You don't get locked out of your own funds because your policy timer ran out.
- **There is no minimum or maximum.** You can set it to ten seconds from now, or ten years. The contract doesn't second-guess.
- **`block.timestamp` is per-block, not per-second precision.** On Fuji that's ~2 second resolution; on Anvil with `--block-time 0`, it's whatever you `vm.warp` to.

The demo UI takes a number-of-hours input and computes `expiresAt = floor(now/1000) + hours * 3600` ([`PolicyDialog.tsx:78`](../../web/components/PolicyDialog.tsx)). Default 24 hours.

### `authorizedAgent` — the one EOA

The address that holds the agent's private key. Exactly one per policy.

```solidity
if (msg.sender != p.authorizedAgent) revert UnauthorizedAgent();     // PolicyVault.sol:182, 206
```

This is **not** soft-rejected. Any call from a non-authorised address to `(try)proposePurchase` reverts with the `UnauthorizedAgent` custom error. The reason: an unauthenticated caller should not be able to write events to your slot — that would be an event-spam channel. Authorised callers get typed-rejection events; everyone else gets a hard revert.

To "rotate" the agent — say the LLM provider's key got compromised — you call `setPolicy` again with a new `authorizedAgent`. The version bumps, the old key stops working immediately, the new one starts. There's no separate `setAgent`; everything flows through `setPolicy`.

### `allowedMerchants[]` — the recipient allowlist

Up to 20 addresses that can receive funds. The merchant in a `proposePurchase` call must be byte-for-byte one of these addresses.

```solidity
if (!_isAllowed(p.allowedMerchants, merchant)) return Reason.MerchantNotAllowed;     // PolicyVault.sol:226

function _isAllowed(address[] storage list, address merchant) internal view returns (bool) {
    uint256 n = list.length;
    for (uint256 i = 0; i < n; i++) {
        if (list[i] == merchant) return true;
    }
    return false;
}
```

The list stores **addresses**, not ENS names. The vault has no way to resolve `merchant-a.safespend.eth` — that's an off-chain operation against mainnet ENS, performed by [`agent/src/ens.ts`](../../agent/src/ens.ts) (in the agent) or [`web/lib/ens.ts`](../../web/lib/ens.ts) (in the policy dialog) before the address ever reaches the vault.

The cap of 20 is from `MAX_ALLOWLIST` ([`PolicyVault.sol:16`](../../contracts/src/PolicyVault.sol)). It exists because `_isAllowed` is a linear scan — without a cap, a misconfigured policy with 10 000 merchants would burn gas on every purchase. 20 is plenty for human-curated lists; it forecloses the gas-grief footgun.

[Test 3](../../contracts/test/PolicyVault.t.sol) pins the boundary: 21 entries reverts with `AllowlistTooLong`.

## What `setPolicy` actually does, line by line

Full source ([`PolicyVault.sol:97–120`](../../contracts/src/PolicyVault.sol)):

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

    emit PolicySet(
        msg.sender,
        p.version,
        input.authorizedAgent,
        input.maxPerTx,
        input.maxTotal,
        input.expiresAt
    );
}
```

Walk-through:

1. **Allowlist length check.** Fail fast on a 21-entry list before doing any storage work.
2. **Storage pointer.** `p` is a reference into the user's slot in `_policies`. Every assignment below writes to that slot.
3. **Bulk-write the four scalar fields.** `maxPerTx`, `maxTotal`, `expiresAt`, `authorizedAgent`.
4. **Bump the version.** This is the only place `version` is mutated. It only ever increases.
5. **Replace the allowlist.** `delete p.allowedMerchants` clears the dynamic array, then a loop pushes each new entry. This is full replacement — there is no add/remove API.
6. **Emit `PolicySet`.** `version` is indexed so an off-chain listener can find the exact event for any version.

What `setPolicy` **does not** touch:

- `spent[user]` — preserved across resets ([test 2](../../contracts/test/PolicyVault.t.sol)).
- `deposited[user]` — preserved across resets.
- The vault's USDC balance for this user.

In other words, `setPolicy` rotates the **rules**, not the **money**. Your deposit stays in the vault; only the rules governing how it can be spent change.

## The version number as audit signal

`version` is a `uint64` — astronomical headroom. It serves two purposes:

1. **Sentinel.** `version == 0` means the slot is empty. The vault uses this in `tryProposePurchase` ([line 198](../../contracts/src/PolicyVault.sol)) and `_depositFor` ([line 152](../../contracts/src/PolicyVault.sol)) to detect "no policy has been set."
2. **Audit anchor.** Every approved purchase emits the version it ran under, **indexed** ([line 242](../../contracts/src/PolicyVault.sol)). [Test 22](../../contracts/test/PolicyVault.t.sol) pins this.

So if your policy history is

| Version | Set at | `maxTotal` | `authorizedAgent` |
|---:|---|---:|---|
| v1 | 14:00 | 500 | 0x3C44…3BC |
| v2 | 16:00 | 300 | 0x3C44…3BC |
| v3 | 18:00 | 300 | 0xNEW…AGENT |

…and a `PurchaseApproved` event with `policyVersion = 1` lands on chain, you can prove that at the time of the spend, the rules were "v1 with maxTotal=500, agent=0x3C44…3BC." That's a tamper-evident audit trail: the rules at the time of the spend cannot be retroactively rewritten by a later `setPolicy`.

## Replacing a policy versus topping it up

There is no "edit one field" API. Every `setPolicy` is a full replacement. So if you want to:

| Goal | What you do |
|---|---|
| Add merchant-c to the allowlist | Re-submit `setPolicy` with merchant-a, merchant-b **and** merchant-c |
| Bump `maxPerTx` from 100 to 200 | Re-submit with the same agent, same merchants, same expiry, new `maxPerTx = 200` |
| Extend the deadline by another day | Re-submit with the same fields and a new `expiresAt` |
| Rotate the agent | Re-submit with everything the same but a new `authorizedAgent` |
| Pause spending entirely | Re-submit with `allowedMerchants = []` (the agent calls all reject `merchant_not_allowed`) |
| Resume spending | Re-submit with the desired allowlist |

Each of these bumps the version and emits `PolicySet`. The version monotonicity means you can replay history from chain events alone — no off-chain database needed for audit.

## What the demo UI does on your behalf

The web app's `PolicyDialog` ([`web/components/PolicyDialog.tsx`](../../web/components/PolicyDialog.tsx)) is the human-friendly wrapper around `setPolicy`. Its job is to:

### 1. Take inputs in human units

The form fields are:

| Field | UI input | Sent on chain |
|---|---|---|
| Max per tx | `"100"` (string, USDC) | `100_000_000` (`bigint`, base units) |
| Max total | `"500"` (string, USDC) | `500_000_000` (`bigint`, base units) |
| Expires in | `"24"` (string, hours) | `now + 24*3600` (`bigint`, unix seconds) |
| Authorized agent | `0x3C44Cd…3BC` (string) | `0x3C44Cd…3BC` (`Hex`) |
| Allowed merchants | One per line, mix of addresses and `.eth` names | `Hex[]` after ENS resolution |

The unit conversion happens in [`PolicyDialog.tsx:92–98`](../../web/components/PolicyDialog.tsx) via the `parseUsdc` helper.

### 2. Resolve ENS names before submission

Each line of the merchants textarea is checked. If it's a hex address, kept as-is. If it contains a `.`, it's treated as an ENS name and resolved against mainnet ([`PolicyDialog.tsx:36–70`](../../web/components/PolicyDialog.tsx)). The submit button stays disabled until **every** merchant line resolves successfully (`allMerchantsOk`).

The resolution status is shown inline:

- `address` — already a hex address, no resolution needed.
- `ens-pending` — resolution in flight.
- `ens-resolved` — resolved to address; the policy will store the resolved address.
- `ens-failed` — no ENS resolver; cannot submit.
- `invalid` — neither a hex address nor a `.eth` name.

This is purely UX. The contract sees only the resolved addresses; the human-readable name is preserved off-chain in the agent transcript and the listing tool.

### 3. Submit the wallet transaction

Once `allMerchantsOk`, hitting "Set policy" triggers a `writeContract` with viem ([`PolicyDialog.tsx:87–101`](../../web/components/PolicyDialog.tsx)). MetaMask prompts the user; the user signs from their depositor key. The vault's `setPolicy` records the new policy under that signer's address.

### 4. Show transaction state

`isPending` (waiting for wallet), `confirming` (waiting for inclusion), `isSuccess` (mined). On success, the dialog closes after a 1 second beat and the parent component refreshes the on-chain reads (policy version, balances, allowance, deposited).

## Setting a policy from a script

Outside the demo UI, you can call `setPolicy` from any signer. Foundry script form:

```solidity
PolicyVault vault = PolicyVault(VAULT_ADDRESS);

address[] memory merchants = new address[](2);
merchants[0] = MERCHANT_A;
merchants[1] = MERCHANT_B;

vm.startBroadcast();
vault.setPolicy(PolicyVault.PolicyInput({
    maxPerTx:        100e6,
    maxTotal:        500e6,
    expiresAt:       block.timestamp + 1 days,
    authorizedAgent: AGENT_EOA,
    allowedMerchants: merchants
}));
vm.stopBroadcast();
```

viem (TypeScript) form, mirroring the dialog:

```ts
import { policyVaultAbi } from "@/lib/contracts";

await walletClient.writeContract({
  address: VAULT_ADDRESS,
  abi: policyVaultAbi,
  functionName: "setPolicy",
  args: [{
    maxPerTx: parseUsdc("100"),
    maxTotal: parseUsdc("500"),
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + 24 * 3600),
    authorizedAgent: AGENT_EOA,
    allowedMerchants: [MERCHANT_A, MERCHANT_B],
  }],
});
```

Both must be signed by the depositor's key.

## Common questions about policy design

**Can I have two agents?**
No. One `authorizedAgent` per user. If you want two agents, use two depositor accounts with two policies. (Or, in the future, generalise the field to `address[] authorizedAgents` — but v1 is single-agent by design.)

**Can I expire a policy early without setting a new one?**
Set a new policy with `allowedMerchants = []`. Every spend will reject `merchant_not_allowed`. Or set `expiresAt = block.timestamp` to immediately expire. Either way, you can still `withdraw` your unspent funds.

**Can the agent set the policy?**
No. `msg.sender` to `setPolicy` is the policy owner. The agent's EOA could *technically* call `setPolicy`, but it would set the **agent's own** policy, not yours. The agent has no way to modify the depositor's policy because it doesn't have the depositor's key. (This is the whole design.)

**Can someone else read my policy?**
Yes. Policies are public. `getPolicy(address user)` and `allowedMerchants(address user)` are public view functions. There is no privacy here — chain state is public. If you want a private allowlist, that's a different protocol (zk membership proofs, off-chain commitments).

**What if I want to allow one specific listing, not a whole merchant?**
The vault doesn't have listing-level granularity. You'd do this off-chain by curating which listings the agent ever sees. The on-chain layer is "this merchant can receive at most `maxPerTx`." Listing-level approval would be a v2 feature (probably a per-listing-hash signature from the depositor).

**What's the gas cost?**
A `setPolicy` with two merchants on Fuji is ~120 k gas; with twenty merchants it's ~280 k gas. Cheap. The expensive operation is per-spend (`tryProposePurchase` is ~85 k gas), and that scales linearly in allowlist size — which is the reason for the cap of 20.

## Reading on

- [`onboarding.md`](./onboarding.md) — the four-step user flow that wraps `setPolicy` for first-time users
- [`guardrails.md`](./guardrails.md) — what the policy enforces, line by line
- [`PolicyDialog.tsx`](../../web/components/PolicyDialog.tsx) — the UI source
- [`PolicyVault.sol:97–120`](../../contracts/src/PolicyVault.sol) — the function source
