# SafeSpend

SafeSpend is a programmable wallet safety layer for AI agents.

The 24-hour build plan lives at [docs/24-hour-build-plan.md](docs/24-hour-build-plan.md). It is the source of truth for contract semantics, agent loop, and demo flow.

## Layout

```
contracts/   Foundry project: PolicyVault, MockUSDC, tests, deploy/seed scripts
agent/       TypeScript agent: provider-agnostic LLM adapter, viem, CLI
web/         Next.js demo UI
shared/      ABIs, addresses, explorer link helper, shared TS types
```

`contracts/` is a Foundry project and is not part of the pnpm workspace. Everything else is.

## Quickstart

For first-time setup and for handing the project to teammates, see **[docs/run-walkthrough.md](docs/run-walkthrough.md)**. Two paths there: a one-command Docker setup (`docker compose up`) and a manual three-terminal walkthrough.

TL;DR Docker:

```sh
echo "OPENAI_API_KEY=sk-..." > .env
docker compose up
# then point MetaMask at http://127.0.0.1:8545 (chain id 31337)
# and open http://localhost:3000
```

Minimal smoke check (no Docker, no UI):

```sh
# 1. Install pnpm deps for agent/web/shared
pnpm install

# 2. Install Foundry deps (OpenZeppelin etc.)
forge install --root contracts

# 3. In one terminal: local chain
pnpm anvil

# 4. Build and test contracts
pnpm contracts:build
pnpm contracts:test

# 5. Typecheck workspace
pnpm typecheck
```

## Deploying to Fuji

For the public-explorer demo on Avalanche Fuji testnet, see [docs/fuji-deploy.md](docs/fuji-deploy.md). One command (`pnpm fuji:deploy`) plus a wallet click-through.

## LLM provider

The agent uses a provider-agnostic adapter. Default is OpenAI with `gpt-4o-mini`. Set `LLM_PROVIDER=anthropic` in `.env` to switch to Claude. See `.env.example`.
