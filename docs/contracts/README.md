# SafeSpend smart contracts — deep dive

This folder is the long-form explanation of how SafeSpend's on-chain layer works, what it guarantees, and where its limits are. It is written for three audiences:

- **Yourself / future-you** — coming back to this code in a month and needing to remember why a decision was made.
- **Teammates** — onboarding, code review, demo prep, and thinking about how to extend the design without weakening it.
- **Outside readers** — judges, security reviewers, prospective contributors, integrators who want to know what they would be trusting.

If you only have a minute, read the [pitch in the top-level README](../../README.md) and [`overview.md`](./overview.md) below. If you have ten minutes, read the three "read first" docs in order. If you have an hour, read everything.

## The nine docs

**Read first**

1. **[overview.md](./overview.md)** — *What lives where, and why.*
   The two-contract architecture, the on-chain / off-chain split, the data model, the lifecycle of a single purchase, and the assumptions every other doc in this folder builds on.

2. **[set-policy.md](./set-policy.md)** — *How `setPolicy` works, in detail.*
   The five fields of a `Policy`, what each one enforces, what happens line-by-line in the function, how the version bump works as an audit signal, and what the `PolicyDialog` UI does on your behalf.

3. **[onboarding.md](./onboarding.md)** — *The 1 / 2 / 3 / 4 flow, end to end.*
   The four-step user checklist (set policy → mint → approve → deposit), what each step does on chain, why the order is load-bearing, and what the seed script does instead on Fuji.

**Operational + threat model**

4. **[guardrails.md](./guardrails.md)** — *The rejection matrix and the threat model.*
   Every reason a purchase can be rejected, with the exact line of Solidity that enforces it. What attacks we defend against, what attacks are explicitly out of scope, and where the trust boundary sits.

5. **[sequence-diagram.md](./sequence-diagram.md)** — *The two-lane demo, step by step.*
   ASCII swimlanes showing the safe and vulnerable lanes side by side: same prompt-injected listing, opposite outcomes. Where each layer of defence sits.

6. **[new-chain-deploy.md](./new-chain-deploy.md)** — *Deploying SafeSpend to a new EVM chain.*
   Step-by-step for Sepolia, Base Sepolia, or any other EVM chain — decisions, deploy commands, the four wiring files that need editing, and source-verification notes.

**Reference**

7. **[adr-0001-v1-design.md](./adr-0001-v1-design.md)** — *Architecture Decision Record.*
   Ten load-bearing decisions (single-token, one-agent, no-admin, CEI, etc.) with the alternatives we considered and the trade-offs we chose.

8. **[v2-wishlist.md](./v2-wishlist.md)** — *Prompt-injection coverage and where the friction lives.*
   Honest answer to *"what about other prompt injection attacks?"* Fourteen attack types with v1's outcome for each, the friction critique of the merchant allowlist, and concrete v2 directions that address each gap.

9. **[glossary.md](./glossary.md)** — *Words used in this codebase, defined.*
   Depositor, agent, merchant, listing hash, policy version, allowlist, reason code — concise definitions so the rest of the docs read smoothly even if you haven't touched Solidity in a while.

## Source files referenced throughout

| File | Purpose |
|---|---|
| [`packages/contracts/src/PolicyVault.sol`](../../packages/contracts/src/PolicyVault.sol) | The whole policy engine — 272 lines of Solidity |
| [`packages/contracts/src/MockUSDC.sol`](../../packages/contracts/src/MockUSDC.sol) | A 6-decimal ERC-20 with a public `mint`, for hackathon / testnet use only |
| [`packages/contracts/test/PolicyVault.t.sol`](../../packages/contracts/test/PolicyVault.t.sol) | 23 Foundry unit tests, one per branch of the policy matrix |
| [`packages/contracts/script/Deploy.s.sol`](../../packages/contracts/script/Deploy.s.sol) | Deploys MockUSDC, then PolicyVault pinned to it |
| [`packages/contracts/script/Seed.s.sol`](../../packages/contracts/script/Seed.s.sol) | Pre-funds both demo lanes with 500 USDC each |
| [`packages/sdk/src/types.ts`](../../packages/sdk/src/types.ts) | TypeScript mirror of the on-chain `Policy` struct and reason codes |
| [`packages/agent-core/src/tools/proposePurchase.ts`](../../packages/agent-core/src/tools/proposePurchase.ts) | The tool the LLM actually calls — routes to safe (vault) or vulnerable (direct transfer) |
| [`apps/merchant/components/PolicyDialog.tsx`](../../apps/merchant/components/PolicyDialog.tsx) | The form that wraps `setPolicy` — units, ENS resolution, submission |
| [`apps/merchant/components/Onboarding.tsx`](../../apps/merchant/components/Onboarding.tsx) | The four-step checklist that drives a first-time user from connected wallet to deposited vault |

## Status

Hackathon prototype, source-verified on Sourcify, deployed to Avalanche Fuji. **Not audited. Not for mainnet.** Anything in this folder describing future hardening (multi-token support, formal audit, MetaMask Snap, etc.) is forward-looking, not implemented.
