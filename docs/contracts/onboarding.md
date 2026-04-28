# Onboarding — the 1 / 2 / 3 / 4 flow, end to end

The first time a user opens the demo, they see a four-step checklist. This document explains exactly what each step does, why it exists in that order, what tx is sent on chain, and what the contract checks at each gate. The visible UI is in [`apps/merchant/components/Onboarding.tsx`](../../apps/merchant/components/Onboarding.tsx); this is the "what's actually happening" companion.

If you only want to *run* the demo, see [`docs/run-walkthrough.md`](../run-walkthrough.md). This doc is for understanding it.

## The flow at a glance

```
   ┌────────────────────────────────────────────────────────────────────┐
   │                                                                     │
   │  1. Set spending policy   →   PolicyVault.setPolicy(...)            │
   │     (rules)                                                         │
   │                                                                     │
   │  2. Mint MockUSDC          →   MockUSDC.mint(user, 1000e6)          │
   │     (demo cash, testnet only)                                       │
   │                                                                     │
   │  3. Approve vault          →   MockUSDC.approve(vault, max)         │
   │     (ERC-20 allowance)                                              │
   │                                                                     │
   │  4. Deposit                →   PolicyVault.deposit(500e6)           │
   │     (vault now custodies your USDC)                                 │
   │                                                                     │
   └────────────────────────────────────────────────────────────────────┘
```

Each step is one MetaMask transaction. The whole flow takes about a minute on Fuji, faster on Anvil.

The order is **not** decorative. It's load-bearing — each step has a precondition that the previous one satisfies. We'll see why in each step's section.

## Why this order

You might reasonably ask: "Why do I have to set a policy *before* I deposit any money? Surely deposit should come first?"

Three answers:

1. **The contract enforces it.** `_depositFor` reverts with `NoPolicy` if the user has `version == 0` ([`PolicyVault.sol:152`](../../packages/contracts/src/PolicyVault.sol)). [Test 4](../../packages/contracts/test/PolicyVault.t.sol) pins this. We made the choice deliberately: depositing into a slot with no policy means the funds are only ever withdrawable, not spendable — the only useful action against that state is `withdraw`, which makes the deposit a no-op. So we just don't allow it.

2. **The policy is the invariant.** As soon as funds enter the vault, there must be a defined rule for who can spend them. The policy *is* that rule. No policy → no funds. This simplifies the trust model: you can never have orphaned funds in the vault that no policy governs.

3. **It catches misconfiguration early.** If the user funds the vault and *then* discovers they typed the wrong agent address into the policy, they have to withdraw and redo. By forcing policy first, we catch the configuration issue before any money is at risk.

Steps 2 → 3 → 4 then follow the standard ERC-20 dance:

- 2 mints test-net cash (you're never doing this on mainnet — mainnet, you'd already have USDC).
- 3 sets an allowance on the ERC-20 so the vault can `transferFrom`.
- 4 calls `deposit`, which uses that allowance to pull funds in.

This is the same mint/approve/deposit pattern any DeFi vault uses. The novelty is that step 1 (set policy) comes first, not last.

## Step 1 — Set spending policy

**On chain:** `PolicyVault.setPolicy(PolicyInput)`
**Source:** [`Onboarding.tsx:80–95`](../../apps/merchant/components/Onboarding.tsx) opens [`PolicyDialog`](../../apps/merchant/components/PolicyDialog.tsx)
**Signer:** Depositor (the connected wallet)
**Gas:** ~120 k with two merchants

The user fills out the policy dialog ([covered in detail in `set-policy.md`](./set-policy.md)) and signs. The transaction calls `PolicyVault.setPolicy` with:

- `maxPerTx` — `100 USDC` default (`100_000_000` base units)
- `maxTotal` — `500 USDC` default
- `expiresAt` — 24 hours from now
- `authorizedAgent` — pre-filled with the Anvil agent EOA on local; user-edited on Fuji
- `allowedMerchants[]` — pre-filled with merchant-a and merchant-b; ENS names accepted

The contract:

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

After this transaction lands:

- `getPolicy(user).version == 1` (or higher if the user has rotated before).
- A `PolicySet` event is on chain.
- The other three steps are now unblocked (they all check `hasPolicy` before enabling).

**The UI logic** ([`Onboarding.tsx:57–58`](../../apps/merchant/components/Onboarding.tsx)):

```ts
const policyTuple = policy as { version: bigint } | undefined;
const hasPolicy = policyTuple !== undefined && policyTuple.version > 0n;
```

`hasPolicy` is the gate for steps 2, 3, and 4. Until step 1 lands, those steps render greyed out.

## Step 2 — Mint MockUSDC (demo only)

**On chain:** `MockUSDC.mint(user, 1_000_000_000)` (1 000 USDC at 6 decimals)
**Source:** [`Onboarding.tsx:208–238`](../../apps/merchant/components/Onboarding.tsx) — `MintButton`
**Signer:** Depositor
**Gas:** ~50 k

This step exists *only* on the demo chains (Anvil and Fuji) and *only* because we deployed our own `MockUSDC` for the hackathon. The mock contract has a public `mint`:

```solidity
function mint(address to, uint256 amount) external {
    _mint(to, amount);
}
```

That `external` (no access control) is **the entire reason** this contract is testnet-only. On mainnet you'd point the vault at Circle's real USDC, where minting is restricted to Circle. The user would already hold USDC, and step 2 simply wouldn't exist.

The button mints `1000 USDC` to the connected wallet. We mint more than the deposit amount (1000 vs the 500 that gets deposited in step 4) so the user has spare USDC for retries, multiple deposits, etc.

After this transaction lands:

- `MockUSDC.balanceOf(user) == 1000e6`
- The strip in the onboarding UI updates: "You have 1000.00 USDC."

The UI gate for step 2 → 3 is:

```ts
done={(userBalance ?? 0n) >= FIVE_HUNDRED}      // FIVE_HUNDRED = 500e6
```

…which is the threshold for being able to deposit 500 in step 4. If the user already had ≥500 USDC (e.g. from a previous run), step 2 is auto-marked done and they skip straight to step 3.

## Step 3 — Approve vault to pull USDC

**On chain:** `MockUSDC.approve(vault, 1_000_000e6)` (1M-USDC unlimited-ish allowance)
**Source:** [`Onboarding.tsx:240–270`](../../apps/merchant/components/Onboarding.tsx) — `ApproveButton`
**Signer:** Depositor
**Gas:** ~46 k

Standard ERC-20 step. The vault uses `safeTransferFrom(payer, vault, amount)` inside `_depositFor` ([`PolicyVault.sol:157`](../../packages/contracts/src/PolicyVault.sol)):

```solidity
function _depositFor(address user, address payer, uint256 amount) internal {
    if (_policies[user].version == 0) revert NoPolicy();
    deposited[user] += amount;
    emit Deposited(user, payer, amount);
    usdc.safeTransferFrom(payer, address(this), amount);   // requires allowance
}
```

`safeTransferFrom` only succeeds if the payer has previously called `approve` on the token, granting the vault permission to pull at least `amount` from their balance. Without step 3, step 4 will revert inside the `safeTransferFrom`.

We set the allowance to `1_000_000 USDC` so the user can deposit again later without re-approving. That's a common dApp pattern (sometimes called "infinite approval"). The trade-off: if the vault contract were ever compromised, that allowance is what an attacker could pull. Since the vault is immutable and the source is verified, we judged this acceptable for the demo. Production deployments often prefer per-deposit `approve(amount)` for that reason.

After this transaction lands:

- `MockUSDC.allowance(user, vault) >= 1_000_000e6`
- The deposit button in step 4 unlocks.

UI gate ([`Onboarding.tsx:114–120`](../../apps/merchant/components/Onboarding.tsx)):

```ts
active={
  hasPolicy &&
  (userBalance ?? 0n) >= FIVE_HUNDRED &&
  (userAllowance ?? 0n) < FIVE_HUNDRED
}
done={(userAllowance ?? 0n) >= FIVE_HUNDRED}
```

If the user already approved enough (from a previous session), step 3 is auto-done.

## Step 4 — Deposit into vault

**On chain:** `PolicyVault.deposit(500_000_000)` (500 USDC at 6 decimals)
**Source:** [`Onboarding.tsx:272–300`](../../apps/merchant/components/Onboarding.tsx) — `DepositButton`
**Signer:** Depositor
**Gas:** ~70 k

This is where the funds actually enter the vault's custody.

```solidity
function deposit(uint256 amount) external {
    _depositFor(msg.sender, msg.sender, amount);
}
```

`deposit(amount)` is the user-self path; the more general `_depositFor(user, payer, amount)` lets a third party top up someone else's slot, but the onboarding flow uses the simple self-deposit.

What happens, in order:

1. Vault checks `_policies[msg.sender].version != 0` — passes because step 1 happened.
2. Vault increments `deposited[user]` by 500e6.
3. Vault emits `Deposited(user=msg.sender, payer=msg.sender, amount=500e6)`.
4. Vault calls `usdc.safeTransferFrom(msg.sender, vault, 500e6)` — pulls the USDC into the vault using the allowance from step 3.

After this transaction lands:

- `MockUSDC.balanceOf(user)` decreased by 500.
- `MockUSDC.balanceOf(vault)` increased by 500.
- `PolicyVault.deposited(user) == 500e6`.
- `PolicyVault.spent(user) == 0` (no purchases yet).
- `Deposited` event is on chain.

The whole onboarding flow is now complete. The user can scroll down to the two-lane demo and run a purchase. The agent will see `remainingAllowance(user) == (100e6, 500e6)` — meaning per-tx 100 USDC, total 500 USDC.

## What `done` means in the UI

Each step's status is computed from on-chain reads, not from "did the user click the button." This means:

- **Refreshing the page never loses progress.** The state lives on chain.
- **Connecting a previously-onboarded wallet skips straight to the demo.** All four steps come up as `done`.
- **A failed transaction just stays at `active`.** The on-chain reads are unchanged, so the step doesn't advance.

The four reads happen in `Onboarding.tsx` ([lines 25–55](../../apps/merchant/components/Onboarding.tsx)):

| Read | Contract call | Used by |
|---|---|---|
| `policy` | `vault.getPolicy(user)` | Step 1 done if `version > 0` |
| `balance` | `usdc.balanceOf(user)` | Step 2 done if `>= 500e6` |
| `allowance` | `usdc.allowance(user, vault)` | Step 3 done if `>= 500e6` |
| `deposited` | `vault.deposited(user)` | Step 4 done if `>= 500e6` |

After every successful transaction, `refresh()` re-runs all four reads ([`Onboarding.tsx:63–68`](../../apps/merchant/components/Onboarding.tsx)) so the next step lights up.

## What can go wrong (and what the UI says)

| Symptom | Cause | Fix |
|---|---|---|
| Step 1 transaction reverts with `AllowlistTooLong` | More than 20 merchants in the textarea | Trim the list |
| Step 1 dialog stays disabled | One merchant line failed ENS resolution or is invalid | Fix the offending line |
| Step 2 stays at "active" with `0 USDC` | The mint tx hasn't been mined yet, or you're on a chain without `MockUSDC` deployed | Check `packages/contracts/src/addresses.ts` for the chain id |
| Step 4 reverts with `ERC20: insufficient allowance` | Step 3 never ran, or the allowance is < 500 | Re-run step 3 with the larger allowance |
| Step 4 reverts with `NoPolicy` | Somehow step 1 was skipped (rare — UI gates this) | Run step 1 |
| Step 4 reverts with `ERC20: transfer amount exceeds balance` | Not enough USDC; step 2 minted somewhere else | Re-run step 2 to the connected wallet |

The PolicyDialog surfaces revert messages inline ([`PolicyDialog.tsx:198–202`](../../apps/merchant/components/PolicyDialog.tsx)). The mint / approve / deposit buttons rely on the wallet UI to show errors, since the contracts use standard OZ ERC-20 errors.

## What the seed script does instead, on Fuji

For the *judge-friendly* demo on Fuji, we don't expect the judge to do steps 2–4 manually. The deploy + seed scripts pre-fund both lanes:

```solidity
// packages/contracts/script/Seed.s.sol — relevant part

usdc.mint(msg.sender, SAFE_BUDGET);                  // 500 USDC to deployer
usdc.approve(address(vault), SAFE_BUDGET);           // approve vault
vault.depositFor(user, SAFE_BUDGET);                 // deposit on user's behalf

usdc.mint(agent, VULN_BUDGET);                       // 500 USDC straight to agent
```

Note the difference between the two lanes:

- **Safe lane:** funds go into the vault, on the **user's** behalf, via `depositFor`. The user has to set a policy first (the seed script aborts if they haven't).
- **Vulnerable lane:** funds go *directly* to the agent's session wallet. No vault, no policy, no allowance — the agent just holds the USDC.

This bakes the demo's central asymmetry into the funding step itself: the safe lane is custody-with-policy, the vulnerable lane is custody-on-the-agent. When the prompt-injected listing tries to drain funds, it succeeds against the agent's session wallet (because that wallet has no rules) and fails against the vault (because the vault enforces the policy).

The seed script's `depositFor` requires step 1 to have already happened for the user. So even in the seeded flow, the user still signs `setPolicy` first — they just skip 2/3/4.

## Reading on

- [`set-policy.md`](./set-policy.md) — the deep dive on what step 1 actually configures
- [`guardrails.md`](./guardrails.md) — what the policy enforces once you're onboarded
- [`docs/run-walkthrough.md`](../run-walkthrough.md) — operational walkthrough for first-time users
- [`docs/demo-recipe.md`](../demo-recipe.md) — the 5-minute reproduction script
- [`apps/merchant/components/Onboarding.tsx`](../../apps/merchant/components/Onboarding.tsx) — the source for the four-step UI
