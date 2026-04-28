# Glossary — words used in this codebase, defined

Plain-English definitions of every term that appears in the contracts and the surrounding docs. Skim this on the way in if you're new to the project; come back to it if any of the other docs use a word you can't place.

Terms are grouped into **roles** (who is doing what), **policy** (the data structure that gates spending), **events / reasons** (what comes out the other side), and **operational** (deploy, ENS, listing).

---

## Roles

**Depositor** *(also: user, policy owner)*
The EOA that signs `setPolicy`. Owns the deposited USDC. The only address that can change the policy or withdraw unspent funds. In the demo, this is your MetaMask account.

**Authorised agent** *(also: agent, agent EOA)*
The EOA the LLM agent process holds the private key for. Can call `proposePurchase` and `tryProposePurchase` on behalf of one specific user. Cannot change the policy, deposit, or withdraw. In the demo, this is the Anvil account at `ANVIL_ACCOUNTS.agent`.

**Merchant**
An EOA that receives USDC when a purchase is approved. Identified off-chain by an ENS name (e.g. `merchant-a.safespend.eth`), but the policy stores the resolved address. The policy's `allowedMerchants[]` is the list of addresses that may receive funds.

**Payer** *(specific to `depositFor`)*
Any EOA that calls `depositFor(user, amount)`. The funds come out of the payer's own balance, but they credit the *user's* vault slot. Used for sponsored top-ups (employer, deploy script, third party). Requires the user already has a policy.

**Stranger**
Any EOA that is neither the depositor nor the authorised agent. The vault rejects any call from a stranger to anything privileged. Appears in the test suite as `address internal stranger = makeAddr("stranger")`.

---

## Policy

**Policy**
The record the depositor publishes to authorise spending. One per user, identified by `msg.sender` to `setPolicy`. Stored in `mapping(address user => Policy)` on the vault. Replaced wholesale on every `setPolicy` call.

**`maxPerTx`**
The largest amount the agent may spend in a single `proposePurchase` call. Denominated in USDC base units (6 decimals — `1_000_000` = 1.00 USDC).

**`maxTotal`**
The lifetime budget for this user under any policy version. Compared against `spent[user] + amount`, not against per-policy-version totals — so replacing a policy with a higher `maxTotal` does not reset `spent`.

**`expiresAt`**
Unix timestamp after which all purchases are rejected with `policy_expired`. Withdrawals are still allowed past expiry.

**`authorizedAgent`**
The single EOA address allowed to call `(try)proposePurchase` for this user. Exactly one agent per user; rotating an agent means setting a new policy.

**`version`**
A monotonic 64-bit counter, bumped on every `setPolicy`. Indexed in the `PurchaseApproved` event so an audit trail proves which policy version a spend ran under. `version == 0` means no policy has ever been set.

**`allowedMerchants[]`**
The list of addresses permitted to receive funds. Capped at 20 by `MAX_ALLOWLIST` to bound the cost of `_isAllowed`'s linear scan.

**`PolicyInput`**
The struct the depositor passes to `setPolicy`. Identical to `Policy` minus `version` (which the contract assigns).

**`spent[user]`**
The lifetime sum of approved purchases for this user, across all policy versions. Public on the vault. Never decreases.

**`deposited[user]`**
The lifetime sum of all `deposit` and `depositFor` calls for this user. Public on the vault. Decreases on `withdraw`.

**Unspent**
The withdrawable balance: `deposited[user] - spent[user]`. Computed on the fly; not stored.

**Remaining allowance**
Returned by `remainingAllowance(user)`. The lesser of (a) `maxTotal - spent` and (b) `deposited - spent`, with `maxPerTx` clamped against that. Zero if the policy has expired or doesn't exist. This is what the UI shows in the balance strip.

---

## Events and reasons

**`PolicySet`**
Fired by `setPolicy`. Tells off-chain indexers (the demo's event feed, future analytics) that a user has just published or rotated a policy. `version` is indexed.

**`Deposited`**
Fired on every `deposit` and `depositFor`. `user` is the credited slot, `payer` is the EOA whose funds were pulled.

**`Withdrawn`**
Fired on `withdraw`. Pulls unspent USDC back to the depositor.

**`PurchaseApproved`**
The success signal. Indexed by `user`, `merchant`, `policyVersion`. Plus `amount` and `listingHash` as data fields. The event is emitted *before* the `safeTransfer` (CEI), but they are atomic — the same transaction either both happen or neither does.

**`PurchaseRejected`**
The soft-failure signal. Indexed by `user`, `merchant`, `reasonCode`. Plus the human-readable `reason` string and the `listingHash`. The reason code is `keccak256(reason)`, so the indexed topic is searchable. Emitted only by `tryProposePurchase`; the strict `proposePurchase` reverts instead.

**Reason code**
A `bytes32` topic in the `PurchaseRejected` event, equal to `keccak256(bytes(reason_string))`. Allows event filtering on the indexed topic. The known reason strings are listed below.

**`merchant_not_allowed`**
The merchant address is not in `policy.allowedMerchants[]`. The most common rejection in the demo (the prompt-injection scenario lands here).

**`exceeds_per_tx`**
`amount > policy.maxPerTx`. Single-purchase cap blown.

**`exceeds_total`**
`spent[user] + amount > policy.maxTotal`. Lifetime budget blown. Note this counts spend across *all* policy versions.

**`policy_expired`**
`block.timestamp > policy.expiresAt`. Time-based stop.

**`no_policy`**
`policy.version == 0` — the user has never set a policy. The agent should never see this in normal operation; if they do, it means the seed/onboarding step is missing.

**`insufficient_deposit`**
`spent[user] + amount > deposited[user]`. The policy permits the spend but the vault doesn't hold enough USDC for this user.

**`unauthorized_agent`**
`msg.sender != policy.authorizedAgent`. **Always reverts.** Reserved as a string in `packages/sdk/src/types.ts:30` even though no `PurchaseRejected` event ever uses it in v1.

---

## Operational

**ENS** *(Ethereum Name Service)*
Off-chain DNS-style naming. Resolves `merchant-a.safespend.eth` to an address. Resolution always happens on Ethereum mainnet, even when the spend is on Fuji or Anvil — the address is mainnet-canonical and the same on every EVM chain. Resolution is in [`packages/sdk/src/ens.ts`](../../packages/sdk/src/ens.ts) and [`apps/merchant/lib/ens.ts`](../../apps/merchant/lib/ens.ts).

**Listing**
A merchant offering: `{ id, merchant, amount, title }`. Surfaced to the LLM by the `searchListings` tool. The listing's `id` and `amount` are the inputs to the listing hash.

**Listing hash**
`keccak256(abi.encode(merchant, amount, listingId))`. Computed off-chain in [`packages/sdk/src/chain.ts:44`](../../packages/sdk/src/chain.ts) and emitted in `PurchaseApproved` and `PurchaseRejected`. Opaque to the contract; provides a tamper-evident audit link from event to listing.

**Reason string**
The plaintext label for a rejection (e.g. `"merchant_not_allowed"`). What the LLM transcript and the demo UI show. Hashed to produce the indexed `reasonCode` topic.

**CEI** *(Checks → Effects → Interactions)*
Solidity convention for ordering: validate everything first, update storage second, make external calls last. Used in `_depositFor`, `_execute`, and `withdraw`. Defends against re-entrancy without a separate guard.

**`safeTransfer` / `safeTransferFrom`**
OpenZeppelin's `SafeERC20` library wrappers around ERC-20 calls. Revert on a missing return value or a `false` return — defends against non-compliant ERC-20 tokens. The vault uses these everywhere it touches `usdc`.

**`immutable`** *(Solidity)*
A storage qualifier for variables set once in the constructor and unchangeable thereafter. The vault's `usdc` field is `immutable`, so the token cannot be swapped post-deploy.

**`MAX_ALLOWLIST`**
Constant `= 20`. Caps the linear scan in `_isAllowed`. Set on `setPolicy`'s allowlist length.

**Strict path / observable path**
Two ways to call the vault to spend. The strict path (`proposePurchase`) reverts on failure; the observable path (`tryProposePurchase`) emits a typed event and returns `(false, reason)`. The demo uses the observable path for everything.

**Anvil**
The local devnet from Foundry. Chain id `31337`. Predictable accounts and addresses; what the Docker compose target uses.

**Fuji**
Avalanche's testnet. Chain id `43113`. SafeSpend's public-deployment chain. Block explorer is Snowtrace at `testnet.snowtrace.io`.

**Sourcify**
A contract-source-verification service. The two contracts are `exact_match`-verified there, which means the bytecode at the deployed address corresponds to the exact source in this repo.

**Snap** *(MetaMask Snap)*
Plugin runtime inside MetaMask. SafeSpend doesn't ship a Snap in v1; "before mainnet you'd want…a MetaMask Snap that signs `setPolicy` and routes spends through the vault" is forward-looking ([README.md:142](../../README.md)).

---

## Quick lookup

| Saw this in code | What it means |
|---|---|
| `_policies[user].version == 0` | "this user has never set a policy" |
| `spent[user] + amount > maxTotal` | "this would blow the lifetime budget" |
| `spent[user] + amount > deposited[user]` | "the vault doesn't hold enough for this user" |
| `block.timestamp > p.expiresAt` | "the policy has expired" |
| `msg.sender != p.authorizedAgent` | "this caller isn't the authorised agent — hard revert" |
| `delete p.allowedMerchants` | "wipe the old allowlist before refilling" |
| `keccak256(bytes(r))` | "compute the reason code from the reason string" |

If you spot a term used in the docs that isn't here, please add it.
