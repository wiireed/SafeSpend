# SafeSpend

**Programmable wallet safety for AI agents.**
*The agent can be tricked. The wallet cannot.*

> Built at the [Web3NZ Hackathon](https://web3uoa.nz) under the theme **The Great Handover** — the web is shifting from a place for people to a place for AI agents. SafeSpend is the trust layer that lets humans hand AI their wallets, safely.

---

## Try the live demo

| | |
|---|---|
| **Demo URL** | <https://safespend.eth.limo> *(or [App Runner direct](https://8m3nfbe9w2.ap-southeast-2.awsapprunner.com/))* |
| **Chain** | Avalanche Fuji (43113) |
| **Reproduce in 5 minutes** | [docs/demo-recipe.md](docs/demo-recipe.md) |

The live deployment runs the same code in this repo, behind an AWS App Runner service that talks directly to Fuji RPC and Ethereum mainnet (for ENS resolution). The `safespend.eth` URL resolves via an ENS contenthash → IPFS → redirect to App Runner.

## What it does

A user deposits USDC into a `PolicyVault` contract and sets a policy: max-per-tx, total budget, expiry, an allowlist of merchants, and the address of the AI agent authorised to act. The agent can call `tryProposePurchase`, but the vault decides whether the transfer actually happens.

Two lanes side-by-side in the demo, **same agent, same prompt, same listings**:

| | Vulnerable lane | Safe lane (SafeSpend) |
|---|---|---|
| Spend mechanism | Direct `MockUSDC.transfer` from a session wallet | Vault's `tryProposePurchase`, signed by the agent |
| Bait listing (prompt-injected) | **Money moves**. No on-chain trace. | **Vault rejects**, `merchant_not_allowed` event lands on chain |
| Allowed listing | Money moves | `PurchaseApproved` event lands on chain |
| Audit trail | None — silent loss | Full event history, indexable on Snowtrace |

The agent gets prompt-injected by the bait listing's description in **both** lanes. Only the lane wired through SafeSpend keeps the wallet solvent.

## Architecture, in three layers

```
       USER                                AGENT
         │                                   │
   setPolicy()                       tryProposePurchase(merchant, amount)
         │                                   │
         ▼                                   ▼
       ┌─────────────────────────────────────────┐
       │              PolicyVault                │  ◀── on-chain enforcement
       │  per-tx limit · total budget · expiry · │
       │  authorised agent · merchant allowlist  │
       └─────────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
        PurchaseApproved       PurchaseRejected
        (transfer fires)       (typed reason code)
```

1. **On-chain spending policy.** Solidity contract enforces every spend rule. The policy is set by the depositor and can be updated only by them.
2. **ENS-identified merchants.** Allowlist entries are ENS names (e.g. `merchant-a.safespend.eth`) resolved at the agent layer to addresses. Human-readable, mainnet-canonical, the same address across any EVM chain.
3. **Programmable enforcement.** Every approved or rejected purchase is an indexed event with a typed reason code (`merchant_not_allowed`, `exceeds_per_tx`, `policy_expired`, `no_policy`, `insufficient_deposit`, `unauthorized_agent`).

## Prize tracks covered

| Track | How SafeSpend qualifies |
|---|---|
| **Theme — The Great Handover** | The trust layer for handing AI agents financial autonomy without handing them your whole wallet |
| **Avalanche C-Chain** ($1000) | Live deployment on Avalanche Fuji ([PolicyVault](https://testnet.snowtrace.io/address/0x15b2b50fcc06ccde9e80f4393b828f709f4934ba) · [MockUSDC](https://testnet.snowtrace.io/address/0x6754c656fe1ca74c9941f3d9aeac2d7fd93868e8)) |
| **Fire Eyes / ENS** ($1000) | `safespend.eth` resolves via ENS contenthash to an IPFS-pinned redirect; merchant allowlist uses ENS subnames (`merchant-a.safespend.eth`, `merchant-b.safespend.eth`); agent prefers ENS in tool calls and surfaces the human-readable name in its transcript |
| **NewMoney Builder** ($500) | Programmable merchant tools, treasury controls, on-chain compliance — the policy is the compliance layer |
| **Payments & Invoicing** ($500) | Programmable spend primitive for agent-driven commerce; every transfer carries the policy version + reason code |
| **Local Systems · Aotearoa** ($250) | NZ small-business framing: cafés / hapū-managed grants / Pacific remittance corridors all need agents that can't drain accounts. See the in-page Use Case panel. |

## Verified provenance

- **PolicyVault source on Sourcify** ([exact_match](https://repo.sourcify.dev/contracts/full_match/43113/0x15b2B50FCC06CCdE9e80f4393b828F709f4934Ba/))
- **MockUSDC source on Sourcify** ([exact_match](https://repo.sourcify.dev/contracts/full_match/43113/0x6754C656Fe1CA74C9941f3D9aEaC2d7fd93868e8/))
- **23 unit tests** covering the full policy matrix (`forge test --root contracts -vv`)
- **safespend.eth on ENS** ([ownership + records](https://app.ens.domains/safespend.eth))
- **ENS subnames**: [merchant-a](https://app.ens.domains/merchant-a.safespend.eth) · [merchant-b](https://app.ens.domains/merchant-b.safespend.eth)

## Layout

```
contracts/   Foundry project: PolicyVault, MockUSDC, 23 unit tests, deploy/seed scripts
agent/       TypeScript agent: provider-agnostic LLM adapter (OpenAI/Anthropic), viem, CLI
web/         Next.js demo UI: onboarding, balance strip, two-lane agent runs, on-chain event feed
shared/      ABIs, deployed addresses per chain, explorer link helpers, shared TS types
docs/        Build plan, run walkthrough, Fuji deploy runbook, AWS deploy runbook, demo script, demo recipe, ENS redirect source
scripts/     Bash helpers for Fuji deploy + seed
```

`contracts/` is a Foundry project (Solidity 0.8.24, OpenZeppelin) and is not part of the pnpm workspace. Everything else is.

## Run it locally

For first-time setup and handing the project to teammates, see **[docs/run-walkthrough.md](docs/run-walkthrough.md)**. Two paths there: a one-command Docker setup, and a manual three-terminal walkthrough.

**TL;DR Docker:**

```sh
echo "OPENAI_API_KEY=sk-..." > .env
docker compose up
# then point MetaMask at http://127.0.0.1:8545 (chain id 31337)
# and open http://localhost:3000
```

**Minimal smoke check** (no Docker, no UI):

```sh
pnpm install
forge install --root contracts
pnpm anvil               # one terminal
pnpm contracts:build     # another terminal
pnpm contracts:test      # 23 tests, ~1s
pnpm typecheck
```

## Deploy to Fuji yourself

For a public-explorer deployment, see [docs/fuji-deploy.md](docs/fuji-deploy.md):

```sh
export DEPLOYER_PRIVATE_KEY=0x...      # Fuji-funded EOA, get free testnet AVAX from Core
pnpm fuji:deploy                        # auto-rewrites shared/src/addresses.ts:43113
```

Then walk the onboarding flow in MetaMask on Fuji. ~5 minutes including the faucet wait.

## Deploy to AWS

For the production deployment we shipped to App Runner, see [docs/aws-deploy.md](docs/aws-deploy.md). The Dockerfile is at [web/Dockerfile.prod](web/Dockerfile.prod); the deploy is a one-time ECR push + App Runner service create, with redeploys via `aws apprunner start-deployment`.

## LLM provider

Provider-agnostic adapter, default OpenAI with `gpt-4o-mini`. Set `LLM_PROVIDER=anthropic` in `.env` to switch to Claude. See `.env.example`.

## Pitch in 30 seconds

The web is shifting to a place for AI agents. Today, every agent demo treats the wallet as an afterthought — give the agent the keys and hope it doesn't get tricked. We've shown it gets tricked: the same prompt injection lands in both lanes of our demo. SafeSpend is the trust layer: an on-chain policy contract, ENS-identified merchants, typed rejection events, all auditable on Snowtrace. The agent can be tricked. The wallet cannot.

## Status

Hackathon prototype, deployed to Fuji, source-verified on Sourcify. Not audited. Not for mainnet. The 23 unit tests give us reasonable confidence the policy matrix is enforced correctly; before mainnet you'd want a formal audit and a wallet-side UX layer (e.g. a MetaMask Snap that signs `setPolicy` and routes spends through the vault).

## Repo

- GitHub: <https://github.com/wiireed/SafeSpend>
- Live demo: <https://safespend.eth.limo>
- All work is on `main`. PR history at <https://github.com/wiireed/SafeSpend/pulls?q=is%3Apr>.
