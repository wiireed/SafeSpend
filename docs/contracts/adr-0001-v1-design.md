# ADR-0001: PolicyVault v1 design choices

> **ADR** = Architecture Decision Record. A short note explaining a load-bearing decision: the context, the alternatives we considered, and what we chose. We keep these in `docs/contracts/` so future contributors don't have to re-litigate them by reading git history.

**Status:** Accepted (hackathon prototype)
**Date:** 2025-11 (Web3NZ hackathon week)
**Deciders:** SafeSpend hackathon team

## Context

We had ~24 hours to ship a working demo of "programmable wallet safety for AI agents." The contract layer needed to be:

- Small enough to write, test, and verify in a hackathon timeline.
- Strong enough that the demo's central claim — *the agent can be tricked, the wallet cannot* — was on-chain-defensible, not just rhetoric.
- Simple enough that judges and outside readers could audit the source themselves in <15 minutes.

This ADR records the choices that shaped the design, why we made them, and what we'd revisit before any real-money deployment.

## Decisions

### D1. Single-token, immutable

**What.** The vault holds exactly one ERC-20, pinned at construction:

```solidity
IERC20 public immutable usdc;

constructor(IERC20 _usdc) {
    usdc = _usdc;
}
```

**Alternatives considered.**

- **Multi-token vault** with `mapping(address token => uint256) deposited[user]`. The agent would specify the token in `proposePurchase`.
- **Token-pluggable** with a setter the depositor could change later.
- **Single-token but mutable** (admin can swap the token).

**Why single-token immutable.**

- The demo's narrative is built around USDC. Adding tokens adds UI complexity for no demo benefit.
- `immutable` removes a class of attack — there is no governance lever, no admin key, no upgrade path. The token at deploy is the token forever.
- A pluggable token would force every consumer (agent input validation, balance strip, allowance handling) to be parameterised by token. We'd be doing a lot of work to support a feature the demo doesn't need.

**Cost.** A real-world deployment for a small business that wants to spend in NZD-denominated stablecoins, EUR-denominated stablecoins, *and* USDC would need three vaults. That's fine — they'd have three separate policies anyway.

**Revisit if.** A v2 wants per-token policies. The struct would gain a `mapping(address token => Policy)` shape; the rest of the contract is mostly unchanged. The version-bump-on-replace logic would need a tiny adjustment.

---

### D2. One agent per policy

**What.** The policy struct has `address authorizedAgent` (singular). Exactly one EOA is allowed to call `(try)proposePurchase` for a given user.

**Alternatives considered.**

- **`address[] authorizedAgents`** — a list, like the merchants.
- **A "primary + delegate" model** with one main agent that can authorise sub-agents.
- **Role-based** with OZ AccessControl.

**Why one.**

- The demo only ever uses one agent. We have no reason to test a list.
- "Rotate the agent" is `setPolicy` with a new address. That's simpler than add/remove APIs and gives the same audit story (`PolicySet` with the new agent).
- Multiple agents add a coordination problem (who spent what) and don't actually solve a problem in v1 — you can run multiple parallel policies on multiple deposits if you want multiple agents.

**Cost.** A future use case ("my LLM tries OpenAI then Anthropic, I want to give both keys spend authority") would need two policies or a v2 with `address[] authorizedAgents`.

**Revisit if.** Real users start asking for multiple agents per slot. The change is local: change the field type, change the auth check at lines 182 and 206, the rest of the contract is unchanged.

---

### D3. Linear-scan allowlist with a hard cap

**What.** The allowlist is `address[] allowedMerchants` with `MAX_ALLOWLIST = 20`. Lookup is O(n).

**Alternatives considered.**

- **`mapping(address => bool) allowedMerchants`** — O(1) lookup but no enumeration.
- **Sorted array + binary search** — O(log n) lookup, slow setPolicy.
- **Merkle root of the allowlist** — O(log n) verification with off-chain proofs, complex UX.
- **No cap.**

**Why linear-scan + cap.**

- For n ≤ 20 the linear scan is faster than any alternative — cold storage reads on EVM dominate, and a mapping read is one cold read but the linear scan over 20 entries fits in two SLOAD pages with packing.
- Enumeration matters: the UI needs to show "your current allowlist" to the user. With a mapping you'd need to track an index separately, which is bug-prone.
- The cap is the gas-grief defence: without it, a misconfigured policy with 10 000 merchants would cost megagas per spend.
- 20 is plenty for human-curated lists. A small business with more than 20 distinct merchants probably wants per-category policies.

**Cost.** Anyone who needs >20 merchants needs a different approach — likely a separate policy slot per category, or a v2 that uses a Merkle root.

**Revisit if.** A use case demands hundreds of merchants per policy. Switch to a Merkle root in `setPolicy` and an `(address merchant, bytes32[] proof)` pair in `proposePurchase`. The audit story is the same; the gas profile improves.

---

### D4. `spent[user]` is monotonic across policy resets

**What.** When `setPolicy` is called again, `spent[user]` is **not** reset. Test 2 (`test_SetPolicy_FullyReplacesPrior_DoesNotResetSpent`) pins this.

**Alternatives considered.**

- **Reset `spent` on every `setPolicy`.**
- **Track `spent` per policy version** with `mapping(uint64 version => uint256) spent`.
- **Provide a separate `resetSpent` function** the depositor can call explicitly.

**Why monotonic.**

- The audit invariant is stronger: an attacker who *somehow* induces a policy replacement (e.g. via a wallet UX bug) cannot wipe the lifetime budget by rotating policies.
- `maxTotal` is naturally interpreted as "lifetime ceiling under any policy version" — that's both more conservative and easier to reason about.
- Simpler code. One counter, no version-keyed map.

**Cost.** The user can't "raise the cap and start over." They can only set a new policy with `maxTotal = newCap` and the new effective cap is `newCap - already_spent`. If they want to truly start over, they `withdraw`, abandon the slot, and use a different depositor address.

This trade-off is the right one for adversarial settings — the goal is to make the policy harder to weaken, not easier to refresh. For a benign user it's a small operational papercut.

**Revisit if.** Users complain. The fix is a `resetSpent()` function callable only by the depositor, but with explicit safeguards (reverts if a policy is currently active, etc.).

---

### D5. Strict-revert *and* observable-event API surfaces

**What.** Two functions that do the same thing:

- `proposePurchase(...)` — reverts on every rejection.
- `tryProposePurchase(...)` — emits `PurchaseRejected` with a typed reason and returns `(false, reason)`.

The agent and demo only use the observable variant.

**Alternatives considered.**

- **Only the strict variant.** The agent would catch reverts and parse error selectors.
- **Only the observable variant.** Callers that want to fail-fast would have to check the return value.

**Why both.**

- Failure is **expected** in normal operation — the demo's whole point is that prompt-injected purchases are rejected. Reverting on expected failures means the agent's tx history is full of failed transactions, which is ugly and expensive (a revert still costs gas).
- A typed `PurchaseRejected` event is **indexable**, so analytics and audit tools can filter on `reasonCode` topic. Reverts have only the selector, which is harder to query historically.
- But there are also callers (test scripts, future on-chain integrations) where a revert is the right semantics. So we keep both.

The asymmetry inside `tryProposePurchase` (`unauthorized_agent` reverts; everything else emits) is a separate decision: see the discussion at [`PolicyVault.sol:204–206`](../../packages/contracts/src/PolicyVault.sol). Short version: unauthenticated callers should not be able to write events to your slot.

**Cost.** Two functions to maintain instead of one. Negligible.

**Revisit if.** We add a third semantics. Probably not.

---

### D6. ENS resolution is off-chain only

**What.** The vault stores merchant *addresses*. ENS names like `merchant-a.safespend.eth` are resolved off-chain (in [`packages/sdk/src/ens.ts`](../../packages/sdk/src/ens.ts) and [`apps/merchant/lib/ens.ts`](../../apps/merchant/lib/ens.ts)) before the address is ever passed to the contract.

**Alternatives considered.**

- **On-chain ENS resolution** via the ENS Registry on the chain we're deployed to.
- **Resolve at agent runtime, but pass the ENS name into the contract for the audit log.**

**Why off-chain.**

- ENS lives on Ethereum mainnet. To resolve on-chain on a non-mainnet chain (Fuji, Anvil, an L2) we'd need a cross-chain message, which means an oracle, which means trust + complexity + latency we can't afford in a 24-hour build.
- The address is the canonical identity. The ENS name is human-readable but at the protocol level the address is what enforces the rule.
- Resolved addresses are stored in the policy's allowlist and indexed in events — that's enough for the audit story.

**Cost.** If a merchant rotates their ENS record's address, the depositor has to re-set the policy. We considered this acceptable: ENS rotations are rare, and a stale address fails closed (rejected, not an attacker payout).

**Revisit if.** The demo extends to an environment where on-chain ENS resolution is cheap (e.g. an L2 with native ENS). The change is a `resolve(string ensName)` call inside `setPolicy` — one extra contract dependency, one new failure mode.

---

### D7. CEI everywhere, no `nonReentrant` modifier

**What.** Every function follows Checks → Effects → Interactions:

```solidity
function _execute(...) internal {
    spent[user] += amount;                               // effect first
    emit PurchaseApproved(...);
    usdc.safeTransfer(merchant, amount);                 // interaction last
}
```

We do not use OpenZeppelin's `ReentrancyGuard`.

**Alternatives considered.**

- **Add `nonReentrant` to every external function.** Defence in depth.

**Why CEI alone.**

- The current token (`MockUSDC`) is a vanilla OZ ERC-20 with no callbacks. There is nothing to re-enter from.
- A real USDC has the same property. So in expected use, `nonReentrant` would protect against zero attack surface.
- If the vault were ever pointed at a hook-emitting token (ERC-777, ERC-1363), CEI is sufficient — `spent[user]` is already incremented before the external call, so a re-entrant `tryProposePurchase` from a malicious merchant is evaluated against the post-increment state.
- Adding `nonReentrant` would be free (~2.5 k gas), but we want the property to be **structural** — readable from the function body — not modifier-magic.

**Cost.** Slightly stricter discipline required when adding new functions: you can't blindly do `usdc.safeTransfer(...)` then update storage. The reviewer must check ordering. Twenty-three tests catch the obvious mistakes.

**Revisit if.** We add a function where CEI is genuinely awkward. Then add `nonReentrant` for that function specifically.

---

### D8. No admin, no owner, no pause switch

**What.** `PolicyVault` has no privileged role. There is no `Ownable`, no admin key, no `pause`, no `upgradeTo`. Every action is per-user, signed by that user's key.

**Alternatives considered.**

- **`Ownable` with a deployer-controlled pause switch.**
- **Time-locked admin** for emergency policy disabling.
- **Upgradeable proxy** so we could fix bugs.

**Why none.**

- The demo's whole pitch is "the wallet decides." If a deployer can pause it, the wallet doesn't decide — the deployer does.
- Adding governance adds threat surface (the admin key) and political surface ("who is the admin?"). For a hackathon, neither makes sense.
- `immutable` deployment + Sourcify verification means anyone can audit what they're trusting before depositing. That's stronger than admin-pausable.

**Cost.** If a critical bug is found in deployed code, there is no fix in place. The mitigation: it's a hackathon prototype on testnet, the blast radius is bounded by per-user `maxTotal`, and we have 23 tests covering the policy matrix. Before any mainnet deployment we'd want a formal audit, not an upgrade switch.

**Revisit if.** This goes to mainnet. Even then, the right answer is probably *immutable + audit + a fresh redeployment for any change* (Uniswap-style), not an admin proxy.

---

### D9. `MockUSDC` with public `mint`, kept testnet-only

**What.** `MockUSDC.mint(address to, uint256 amount)` is unrestricted. Anyone can mint to any address.

**Alternatives considered.**

- **Restrict mint to deployer.**
- **Use a real testnet USDC** (Circle's Sepolia USDC, etc.).

**Why public mint.**

- The demo's onboarding step 2 ("mint MockUSDC") is one click for the user. Restricting mint would make this require a separate transaction signed by the deployer key, which the user doesn't have.
- It's testnet. A bad actor can mint themselves trillions of `MockUSDC` — and then have nothing of value, because nothing real backs it.
- Using Circle's testnet USDC would tie the demo to whichever chain Circle has deployed it on. We wanted Anvil + Fuji portability.

**Cost.** Anyone reading the source must immediately understand that this is **not** a real stablecoin. We document this in [`overview.md`](./overview.md) and [`glossary.md`](./glossary.md) and the source itself: *"Hackathon/testnet MockUSDC."*

**Revisit if.** The demo moves to mainnet. Then `MockUSDC` doesn't exist; the vault is constructed with the real USDC address.

---

### D10. Listing hash is opaque to the contract

**What.** `proposePurchase` takes a `bytes32 listingHash` parameter that the contract emits in events but never compares against anything.

**Alternatives considered.**

- **Drop the parameter entirely.** Less data on chain.
- **Verify the listing hash** (e.g. against a depositor-signed merkle root of approved listings).
- **Replay-protect on listing hash.** Reject duplicates.

**Why opaque + emitted.**

- Verifying would mean the depositor has to pre-commit to a list of listings, which is a UX cliff for the demo (you'd need a "publish merchants AND a listing manifest" flow).
- The audit value is in the *traceability* — given a `PurchaseApproved` event, you can re-derive the listing hash off-chain and confirm the on-chain spend was for the listing the agent saw.
- Replay protection on listing hash would prevent the agent from buying the same item twice, which is *valid* behaviour. The right replay defence is `maxTotal`, not listing-hash uniqueness.

**Cost.** Slightly more event data per spend (32 bytes per event). Negligible.

**Revisit if.** A v2 wants per-listing pre-approval (e.g. depositor signs a listing, agent presents the signature, vault verifies). That's a separate feature, not a change to listing hash semantics.

---

## What this design optimises for

Reading the decisions back-to-back, the consistent pattern is:

1. **Make the audit story strong.** Every spend has a typed event with the policy version; every policy change has a `PolicySet` event with a monotonic version.
2. **Minimise admin surface.** No owner, no upgrade, no token swap, no pause. The contract does what its source says it does, forever.
3. **Choose simple over flexible.** One token, one agent, fixed-size allowlist. Add flexibility only when a real use case demands it.
4. **Prefer "fail closed" over "fail flexible."** Stale allowlist? Reject. Expired policy? Reject. No deposit set up? Reject deposits, reject spends.
5. **Push complexity off-chain when on-chain doesn't add safety.** ENS resolution, listing search, prompt construction, model selection — all off-chain. The contract is small.

The decisions that *would* have made the demo more impressive (multi-agent, multi-token, listing pre-approval) all make the contract larger and the audit harder. We chose the smaller surface every time.

## What this design does *not* optimise for

- **Operational flexibility for the depositor.** They can't tweak fields in isolation; every policy change is a full rewrite.
- **Recovery from a lost depositor key.** No social recovery, no escape hatch.
- **Multi-asset spending in a single demo session.** Three tokens means three vaults.
- **Mainnet deployment as-is.** None of the above is in scope until after a formal audit.

These are reasonable v2 directions if SafeSpend grows past the hackathon. They are explicitly not v1.

## Reading on

- [`overview.md`](./overview.md) — the architecture this ADR justifies
- [`set-policy.md`](./set-policy.md) — operational details of the policy field decisions above
- [`guardrails.md`](./guardrails.md) — the threat model that motivated the "fail closed" stance
- [`PolicyVault.sol`](../../packages/contracts/src/PolicyVault.sol) — the source itself
