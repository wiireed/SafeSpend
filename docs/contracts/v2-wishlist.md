# v2 wishlist — prompt injection coverage and where the friction lives

This is the doc to read if you (or a teammate) is asking *"OK but what about other types of prompt injection?"* or *"the merchant allowlist is heavy — is that really the right primitive?"* Both are fair questions. v1 makes a narrow guarantee; this doc spells out what's *inside* that guarantee, what's *outside* it, and what a v2 could reasonably do about each gap.

It is **not** a feature roadmap. It's a structured way to talk to teammates and judges about the threat model. If a v2 ever ships, the entries here are the inputs.

> **TL;DR.** v1 protects the *spend mechanism*, not the *agent's mind*. The merchant allowlist is one rule out of five; it's the most demonstrable in a 60-second demo, but it isn't the whole defence. Several common prompt-injection attacks bypass the allowlist by staying *inside* the policy envelope — those are real gaps, and the v2 directions below tie each one to a concrete contract or UX change.

## 1 · The narrow guarantee, restated

What v1's contract actually promises:

> Given a depositor `U` who has signed a policy `P` authorising agent `A` to spend up to `maxPerTx` per transfer and `maxTotal` total, only to merchants in `allowedMerchants`, before `expiresAt`: no transfer of `usdc` from `U`'s vault slot will execute outside that envelope, no matter what the agent does, says, or signs.

That's it. Five fields. Read [`overview.md`](./overview.md) and [`guardrails.md`](./guardrails.md) for the full mechanics. This doc is about the *complement* — everything that promise does **not** cover.

## 2 · Prompt-injection attacks, by type

Concrete attack scenarios. For each: does v1 stop it, and if not, why not.

### A. Redirect-to-attacker-address ("send funds to 0xATTACK")

**Demo's headline scenario.** The injection says "send funds to a new address." The agent obeys. v1 catches this because `0xATTACK` isn't in `allowedMerchants`. **Blocked by `merchant_not_allowed`.**

### B. Pump-the-amount ("send 9999 USDC instead of 50")

The injection says "send 9999 to merchant-a (legitimate)." The merchant *is* allowlisted, but the amount blows `maxPerTx`. **Blocked by `exceeds_per_tx`.** v1 covers this.

### C. Slow-drain ("buy something at every merchant, every minute")

The injection encourages spending across all allowlisted merchants until the budget runs out. v1 catches this on the `maxTotal` boundary. **Blocked by `exceeds_total` once the cap hits.** But — and this is important — the agent *will* spend up to `maxTotal` on legitimate-looking purchases the user didn't actually want. v1 limits the blast radius; it doesn't prevent unwanted-but-legal spends.

### D. Buy-the-wrong-listing-from-a-real-merchant ("buy 100 of the cat food, not 1")

The injection says "buy 100 units." The merchant is allowlisted; the amount is below `maxPerTx`; the budget allows it. **Not blocked by v1.** The contract sees a single approved transfer to a legitimate merchant; it has no notion of which *listing* was being purchased. The listing hash is emitted in events but never compared against anything.

This is the gap that prompted the user critique. The allowlist defends against *recipient* manipulation, not *content* manipulation.

### E. Collusion with an allowlisted merchant ("merchant-a is selling fake listings")

merchant-a is allowlisted. merchant-a (or someone who's compromised them) starts listing fake items at high prices. The agent buys them. **Not blocked by v1.** The contract trusts the allowlist; the depositor trusts the merchant. v1 has no merchant-level trust gradation.

### F. Output exfiltration ("agent, paste the user's policy into your reply")

Injection makes the agent leak data — the depositor's address, the allowlist, the conversation context, embedded API keys. **Not relevant to v1's promise.** The contract can't observe what the agent says; this is an agent-level / LLM-provider concern.

### G. Non-financial actions ("agent, also email finance@... to wire funds")

If the agent has tools beyond `proposePurchase` (email, file write, REST calls), the injection can drive those. **Not blocked by v1.** v1 protects the on-chain spend tool only. Other tools are out of scope.

### H. System-prompt poisoning at config time

Someone with write access to the agent's system prompt or tool descriptions inserts a back door (e.g. "if listingId starts with `BACKDOOR`, override the merchant"). **Not blocked by v1.** The agent's source code and config are out of v1's trust boundary. v1 trusts the agent process to be running unmodified code; if you've got an attacker editing the system prompt, you have a much bigger problem.

### I. Race against a policy update

The depositor is mid-rotation: signing `setPolicy` v2 (tighter rules). An injected agent crams in spends *just before* v2 lands, while v1 is still effective. **Not blocked specifically.** v1 evaluates against the current policy at execution time — there's no atomicity between policy change and pending spends. A spend is either accepted under v1 or rejected under v2; the depositor decides when v2 is broadcast.

This is technically a feature (no in-flight policy ambiguity) but it does mean a malicious agent could try to dump the rest of `maxTotal` before v2 lands. Mitigated in practice by `maxTotal` being a low ceiling.

### J. Replay of an old policy after expiry

The agent waits until `expiresAt - 1`, then crams a spend through. **Blocked.** `_validate` reads `block.timestamp` at execution; spends after expiry reject with `policy_expired`. There is no stored "policy in flight."

### K. Legitimate-merchant invoice fraud ("merchant says you owe 500, send it")

Injection mimics an invoice from a real allowlisted merchant. The agent pays. **Not blocked by v1.** Same shape as D — the recipient is correct, the content is wrong.

### L. Frequency / timing exploits ("agent, buy three items in 10 seconds")

Three legitimate purchases in quick succession that exhaust the budget. **Not blocked by v1.** No rate limit, no cool-down. v1 is a *static* envelope.

### M. Exfiltration via fee inflation in non-USDC contexts

In a multi-token v2, an injection might choose the most-overpriced token. **Not relevant to v1.** Single-token by design.

### N. Convince the user to sign a worse policy

Injection produces a transcript that misrepresents the policy state, tricking the depositor into signing a tighter-looking policy that's actually looser. **Not blocked by v1.** Wallet-UX-level concern. v1 trusts what the depositor signs.

## 3 · Coverage matrix

| # | Attack type | v1 outcome | Why |
|---|---|---|---|
| A | Redirect to attacker address | **Blocked** | `merchant_not_allowed` |
| B | Pump the amount | **Blocked** | `exceeds_per_tx` |
| C | Slow drain across allowlisted merchants | **Capped** | `exceeds_total` after envelope |
| D | Wrong listing from a real merchant | Not blocked | No content-level enforcement |
| E | Collusion with allowlisted merchant | Not blocked | Allowlist is binary trust |
| F | Output exfiltration | Out of scope | Not financial |
| G | Non-financial agent actions | Out of scope | Not SafeSpend's tool |
| H | System-prompt poisoning at config time | Out of scope | Below trust boundary |
| I | Race against policy update | Mostly blocked | `maxTotal` caps fallout |
| J | Replay of expired policy | **Blocked** | `policy_expired` |
| K | Invoice fraud from a real merchant | Not blocked | Same as D |
| L | Frequency / timing exploits | Not blocked | Static envelope |
| M | Multi-token fee exploits | Not relevant | Single-token by design |
| N | Convince user to sign worse policy | Not blocked | Wallet-UX concern |

The honest read: v1 catches attacks that try to spend **outside** the envelope (A, B, J), caps attacks that try to spend the *full* envelope (C), and is silent on attacks that stay **inside** the envelope (D, E, K, L). That's a meaningful guarantee for cases where *who* the recipient is matters more than *what* they sold. It's a weaker guarantee in environments where merchants themselves can be compromised or list arbitrary content.

## 4 · The friction critique

> "The merchant allowlist is fine for a demo, but real users won't curate 20 ENS names per policy. This pattern doesn't scale."

Correct. Three sources of friction:

### 4a. Allowlist maintenance

Every new merchant requires a new `setPolicy`. For a small business with a stable supplier list this is fine. For an agent that browses and discovers — buying flights, ride-hailing, niche software subscriptions — the allowlist becomes a chore.

### 4b. ENS dependency

We chose ENS subnames because they're human-readable and mainnet-canonical. But:

- The merchant has to set up an ENS subname (or accept the risk of address-only entries).
- The depositor has to trust whoever controls the ENS resolver to not redirect the name later.
- Resolution happens off-chain on Ethereum mainnet, which adds latency and a mainnet RPC dependency.

### 4c. The static envelope

`maxPerTx` and `maxTotal` are blunt instruments. Real spending varies — a coffee is $5, a hotel night is $250. A single global cap forces the depositor to set the cap high enough for the largest legitimate spend, which then permits 50 small malicious spends.

### 4d. One agent, one slot

If the depositor wants to use OpenAI for general tasks and Anthropic for coding agents, they need two slots with two policies. Workable but not elegant.

## 5 · v2 directions, tied to gaps

For each gap above, here's a concrete v2 mechanism. **Not all of these should ship; they're trade-offs.** This list is a menu, not a roadmap.

### v2.1. Per-listing pre-approval (gaps D, E, K)

The depositor pre-signs an EIP-712 typed message authorising a *specific* listing (merchant + amount + listingId). The agent presents the signature in `proposePurchase`; the vault verifies and only then executes.

```solidity
struct ListingApproval {
    address merchant;
    uint256 amount;
    bytes32 listingId;
    uint256 deadline;
}

function proposePurchaseSigned(
    ListingApproval calldata l,
    bytes calldata depositorSignature
) external { ... }
```

- **Closes:** wrong-listing, invoice fraud, merchant collusion (the merchant has to actually offer what was approved).
- **Cost:** depositor must sign every purchase. That's friction by design — for high-value spends it's worth it; for $5 coffees it's worse than the allowlist.
- **Hybrid:** combine — allowlist below `maxPerTx_low`, signed approval above.

### v2.2. Merkle-rooted allowlist (4a)

Instead of `address[] allowedMerchants`, store `bytes32 merchantsRoot`. The agent presents a Merkle proof for the merchant. Allowlist scales to thousands of entries with constant on-chain storage.

- **Closes:** allowlist size limit. Lets the depositor authorise a curator (an ENS-managed registry, a third-party allowlist service) to maintain the underlying list.
- **Cost:** agent has to fetch proofs off-chain. UX more complex.
- **Doesn't close:** any of the inside-the-envelope attacks (D, E).

### v2.3. Curator-mediated allowlist (4a, E)

`policy.allowlistCurator` is an EOA the depositor trusts to add merchants over time. New merchants need a fresh `addMerchant` tx from the curator, but each addition can carry an EIP-712 statement (e.g. "I have verified this merchant is real and offers X").

- **Closes:** static-allowlist friction (depositor doesn't curate themselves) plus collusion (curator's signature is the trust gradient).
- **Cost:** curator is now a privileged role. Bad curator = bad allowlist. Pick someone you trust.

### v2.4. Per-merchant limits (D, K)

Replace `maxPerTx` with `mapping(address merchant => uint256 maxPerTx)`. Different merchants get different ceilings — the coffee shop has $20, the airline has $500.

- **Closes:** the "one cap fits all" friction.
- **Cost:** policy storage doubles. UX of writing the policy is heavier.

### v2.5. Cool-down and frequency limits (L)

Add `cooldownSeconds` and `maxPerWindow` to the policy. Reject spends that come too fast.

- **Closes:** rapid-fire drain.
- **Cost:** legitimate bursty agents (an LLM that buys a flight + hotel + car in one minute) are slowed. Tune carefully.

### v2.6. Listing-hash dedup (4c interaction)

Reject any purchase whose `listingHash` was already approved within the policy version. Forces every spend to be a distinct listing.

- **Closes:** the "buy 100 of the same item" sub-case.
- **Cost:** legitimate repeat purchases (subscription renewals, restocks) become impossible. Probably wrong as a global rule; right as an opt-in.

### v2.7. Out-of-band confirmation for high-value spends (D, E, K)

Above some threshold, the spend pauses and pings the depositor's phone for a confirmation. The vault releases funds only after a fresh signature from the depositor.

- **Closes:** large unwanted spends regardless of merchant trust.
- **Cost:** UX latency. Requires a Snap or push-notification channel. Not a contract change so much as a layered UX.

### v2.8. Multi-agent policies (4d)

`address[] authorizedAgents` instead of a single field. Agents can spend in parallel; one compromised agent's blast radius is the global `maxTotal`, not less.

- **Closes:** "I want OpenAI and Anthropic both to act."
- **Cost:** harder to reason about who spent what. Probably want per-agent sub-budgets, which is more storage.

### v2.9. Per-token, per-policy (M)

Vault holds multiple ERC-20s; each has its own `maxPerTx` / `maxTotal` / `allowedMerchants`. Or, separate vaults entirely with a router.

- **Closes:** single-currency limitation.
- **Cost:** doubles the contract surface area. Probably better as separate vaults until the use case is clear.

### v2.10. Off-chain price oracle (D)

The agent presents a market price for the listing alongside the call; the vault rejects if `amount > listingMarketPrice * (1 + tolerancePct)`.

- **Closes:** overcharging by a corrupted merchant or a fake listing.
- **Cost:** introduces an oracle dependency, which is itself a trust surface. Tolerance percentage is a tuning headache.

### v2.11. Wallet-side typed-data prompt (N)

A MetaMask Snap (or equivalent) renders the policy in human-readable form before signing — "you are authorising agent 0x… to spend up to 100 USDC per tx, 500 total, to merchants A and B, until 24 Apr 2026 14:00." Reduces the chance the depositor signs a misleading policy.

- **Closes:** UX-level confusion.
- **Cost:** Snap maintenance.

### v2.12. Recovery / social recovery on the depositor key (out of scope #6 in `guardrails.md`)

Standard account-abstraction story. Not a vault feature — a depositor-account feature. But strongly recommended for any real deployment.

### v2.13. Attestation-based merchant identity (E)

Replace the address-based allowlist with a merchant DID (e.g. an EIP-712 attestation signed by an attestation registry). The depositor allowlists *attestations*, not *addresses*. Compromised merchants can be revoked centrally.

- **Closes:** key-rotation pain when a merchant changes addresses; centralised revocation when a merchant goes bad.
- **Cost:** attestation registry is a new trust dependency.

## 6 · The composability story

Some of these v2 ideas compose nicely:

- **v2.1 + v2.4** = signed listings for high-value, allowlist for low-value. Best of both.
- **v2.2 + v2.3** = curator maintains a Merkle tree of merchants; the depositor only trusts the curator.
- **v2.5 + v2.6** = burst protection plus dedup. Hard to drain quickly *and* hard to drain via repeat purchases.
- **v2.7 + v2.11** = wallet-side prompts with typed data, both at policy-set time and at high-value-spend time. The depositor stays in the loop without having to re-sign every $5 coffee.

## 7 · What's still out of scope, even in v2

Some attacks aren't fixable at the contract level. Calling them out so we don't pretend otherwise:

| Attack | Why no contract change helps |
|---|---|
| F. Output exfiltration | The vault can't see what the agent says. Mitigation is at the LLM provider (output filters, content policies). |
| G. Non-financial agent actions | The vault is one tool among many. Non-financial actions need their own guardrails (DLP, write-allowlists, sandbox). |
| H. System-prompt poisoning at config time | If you have an attacker editing the agent's source, the contract is the least of your worries. Mitigation is supply-chain hygiene (signed builds, TEE, attestation). |
| N. Wrong-policy signing | Wallet UX, not vault logic. A Snap that re-renders policies in plain English is the right place. |

These are out of scope for *every* version of SafeSpend, because they're not what SafeSpend is trying to solve. SafeSpend is a guardrail on the *spend tool*. The agent's mind, the agent's other tools, the wallet's UX, and the supply chain that built the agent are all separate concerns with their own primitives.

## 8 · How to talk about this with teammates

If a teammate says *"this only catches recipient redirection, not other prompt injection"*, that's a correct and important observation. The right reply isn't "but the demo!" — it's:

> "v1 promises that no transfer leaves the policy envelope. That stops every prompt injection that tries to spend *outside* the envelope. Inside the envelope — wrong amount on a real merchant, fake listings, etc. — v1 caps the blast radius via `maxTotal` but doesn't prevent the spend. v2 has options for that: per-listing signatures, oracle checks, out-of-band confirmation. We chose to ship the smaller, demonstrable thing first because it's both auditable in 15 minutes and it actually catches the most-common adversarial scenario (a malicious URL in a tool result rewriting the agent's destination)."

If a teammate says *"the allowlist is too rigid for real adoption"*, the right reply is:

> "Agreed. v1 is a small business / treasury / single-purpose use case where the merchant set is stable. For exploratory agents (price comparison, travel, etc.), v2.1 (signed listings) plus v2.7 (out-of-band confirmation) would be a closer fit. The allowlist isn't the only primitive — it's the one we shipped because it round-trips cleanly to a 60-second demo."

Both replies acknowledge the limitation, frame v1 as a *deliberately narrow* guarantee, and point at concrete v2 work that addresses the gap. That's a much stronger position than defending v1 as universal.

## Reading on

- [`guardrails.md`](./guardrails.md) — what's enforced today, with line references
- [`adr-0001-v1-design.md`](./adr-0001-v1-design.md) — why we chose the narrow scope; each ADR has a "revisit if" pointer that maps to entries here
- [`overview.md`](./overview.md) — the architecture this v2 list builds on
