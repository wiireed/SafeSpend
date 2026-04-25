# Running SafeSpend locally

Two paths:

- **[Docker quickstart](#docker-quickstart)** — one command, no local Foundry/Node setup. Recommended for teammates who just want to see it run.
- **[Manual three-terminal walkthrough](#manual-walkthrough)** — explicit Tier 1/2/3 with full control. Use this if you need to iterate on contracts or want to run the unit tests.

Both paths produce the same demo. MetaMask setup is the same for both.

---

## Docker quickstart

One command: `docker compose up`. Brings up anvil, runs the deploy + agent-funding scripts, and starts the Next.js dev server. ~3 minutes on first run (image pulls + `pnpm install`), ~30s after that.

### Prereqs

- **Docker Desktop** running (or any Docker engine + Compose v2)
- **MetaMask** browser extension
- **OpenAI API key** with a hard usage cap set ([Settings → Limits](https://platform.openai.com/settings/organization/limits) → $5)

### Steps

1. Clone and enter the repo:
   ```sh
   git clone https://github.com/wiireed/SafeSpend.git
   cd SafeSpend
   ```
2. Create a `.env` file at the repo root with your key:
   ```sh
   echo "OPENAI_API_KEY=sk-..." > .env
   ```
   (`.env` is gitignored. `OPENAI_MODEL` defaults to `gpt-4o-mini`; override in the same file if needed.)
3. Bring everything up:
   ```sh
   docker compose up
   ```
   Wait for the Next.js `Ready in N s` line. The anvil + deploy + mint sequence runs first, then the dev server starts. Total time on a warm cache: ~30 seconds.
4. **MetaMask:**
   - Easiest: connect your wallet on http://localhost:3000 first; the page shows an **Add / switch to Anvil** button that calls `wallet_addEthereumChain` so you don&rsquo;t have to type the RPC URL yourself.
   - Manual fallback — Add Anvil network: name `Anvil`, RPC `http://127.0.0.1:8545` (the `http://` prefix is required, otherwise MetaMask shows &ldquo;Could not fetch chain ID&rdquo;), chain id `31337`, currency `ETH`.
   - Import the user account: paste private key `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` (anvil account #1, address `0x7099…79C8`).
   - **Switch network selector to Anvil.**
   - Expected (cosmetic) warnings: MetaMask suggests &ldquo;GoChain Testnet&rdquo; / currency `GO` because chain ID 31337 collides with that entry in MetaMask&rsquo;s public chain registry. These are safe to ignore for local Anvil.
5. Open http://localhost:3000, walk the onboarding (Set policy → Mint → Approve → Deposit), then click Run on each agent panel.

### What's running

| Service | Port | Role |
|---|---|---|
| `anvil` | 8545 | Local Ethereum chain (chain id 31337) |
| `deploy` | — | One-shot. Inits Foundry submodules, deploys MockUSDC + PolicyVault at pinned addresses, mints 500 USDC to the agent wallet. Exits cleanly. |
| `web` | 3000 | Next.js dev server. Server-side talks to `http://anvil:8545` (Docker network). Browser-side and MetaMask use `http://127.0.0.1:8545` (host port mapping). |

### Stopping and restarting

- `Ctrl+C` in the terminal running `docker compose up` stops everything.
- `docker compose down` removes containers and the anvil chain state. Next `up` re-deploys cleanly. **Use this when you want a fresh demo.**
- `docker compose down -v` also removes the `node_modules` volumes — only needed if you're rebuilding deps from scratch.

### Docker troubleshooting

| Symptom | Fix |
|---|---|
| `required variable OPENAI_API_KEY is missing` | Create `.env` at the repo root with `OPENAI_API_KEY=sk-...` |
| Port 8545 or 3000 already in use | Stop the conflicting process (`lsof -ti:8545 \| xargs kill`) or change the port in `docker-compose.yml` |
| `pnpm install` errors with arch mismatch | `docker compose down -v` to drop the node_modules volumes, then `up` again |
| Web shows `policy v0` after page load and click Set policy fails silently | MetaMask is on Ethereum mainnet — switch to Anvil |
| MetaMask: &ldquo;Could not fetch chain ID. Is your RPC URL correct?&rdquo; | RPC URL is missing the `http://` prefix. Use `http://127.0.0.1:8545`, not `127.0.0.1:8545` and not `localhost:8545`. Or click the **Add / switch to Anvil** button on the page. |
| MetaMask warns the network name &ldquo;may not match&rdquo; / suggests `GoChain Testnet` / suggests currency `GO` | Cosmetic. Chain ID 31337 collides with GoChain Testnet in MetaMask&rsquo;s registry. Save the network anyway. |
| MetaMask shows stale balances or transactions get stuck after `docker compose down && up` | The chain was wiped but MetaMask still has the old nonce/activity cache. **MetaMask → Settings → Advanced → Clear activity tab data** for the imported account. |
| Browser can't reach RPC at all | Make sure Docker Desktop's port mapping is enabled — `curl http://127.0.0.1:8545` should respond |

---

## Manual walkthrough

Use this if you want to run the unit tests, iterate on contracts without rebuilding a container, or just prefer explicit control.

Three tiers. Each tier is a stopping point — they build on each other but each one stands alone as a demo.

| Tier | What you prove | Time | Needs |
|---|---|---|---|
| 1 | Contract policy logic works (23 unit tests) | 30s | Foundry |
| 2 | Local chain + UI + onboarding + balances live-update | 5m | + MetaMask |
| 3 | Both agents run end-to-end against the chain | 2m | + OpenAI key |

---

## Prereqs (one-time)

- **Node 20+** — `node --version`
- **pnpm 9+** — `pnpm --version` (Corepack will install on demand)
- **Foundry** — `curl -L https://foundry.paradigm.xyz | bash` then `foundryup`
- **MetaMask** browser extension

### macOS install gotchas

After running the Foundry installer, `forge` won't be on PATH yet. Do this:

```sh
source ~/.zshenv
foundryup
forge --version
```

If `forge --version` still says command not found, open a fresh terminal tab and try there — PATH propagation lands cleanly in a new shell.

If you're pasting commands that contain `# comments` and zsh complains `command not found: #`, run this once per shell:

```sh
setopt interactive_comments
```

---

## Setup (one-time)

```sh
git clone https://github.com/wiireed/SafeSpend.git
cd SafeSpend
pnpm install
forge install --root contracts
```

`forge install` pulls OpenZeppelin and forge-std submodules into `contracts/lib/`. Takes ~10 seconds.

---

## Tier 1 — Contract tests (~30 seconds)

```sh
forge test --root contracts -vv
```

Expected last line:

```
Suite result: ok. 23 passed; 0 failed; 0 skipped
```

That's the entire policy matrix proving `PolicyVault` rejects merchants not on the allowlist, transactions over per-tx, transactions over total, expired policies, unauthorized agents, etc. If any fail, stop and investigate before going further.

---

## Tier 2 — Local chain + UI walkthrough (~5 minutes)

You'll need three terminal tabs in the repo root.

### Tab 1 — anvil

```sh
pnpm anvil
```

Leave it running. It prints 10 pre-funded accounts. We use:

| Role | Address | Notes |
|---|---|---|
| Deployer | `0xf39F…2266` | Account #0, runs Deploy.s.sol |
| User | `0x7099…79C8` | Account #1, you import this into MetaMask |
| Agent | `0x3C44…93BC` | Account #2, the server-side agent wallet |

All three keys are pinned in `shared/src/addresses.ts:ANVIL_PRIVATE_KEYS`.

### Tab 2 — deploy contracts

```sh
forge script contracts/script/Deploy.s.sol --root contracts \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

Should print:

```
MockUSDC:    0x5FbDB2315678afecb367f032d93F642f64180aa3
PolicyVault: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

These are deterministic on anvil and already pinned in `shared/src/addresses.ts:ADDRESSES[31337]`. The web finds the contracts automatically — no manual copy required.

### Tab 3 — web env file + dev server

Create `web/.env.local`:

```sh
cat > web/.env.local <<'EOF'
CHAIN_ID=31337
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
USER_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
AUTHORIZED_AGENT_ADDRESS=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
VAULT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
USDC_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-leave-blank-for-tier-2
OPENAI_MODEL=gpt-4o-mini
EOF
```

The `PRIVATE_KEY` here is the agent wallet, not the user wallet — it lives only on the server (Next.js API route). Never sent to the browser.

Then start the dev server:

```sh
pnpm -F @safespend/web dev
```

Open http://localhost:3000.

### MetaMask setup

1. **Add the Anvil network.** Easiest path: open http://localhost:3000, click Connect, then click the amber **Add / switch to Anvil** banner — the page calls `wallet_addEthereumChain` for you. Manual fallback if you prefer typing it in:
   - Network name: `Anvil`
   - RPC URL: `http://127.0.0.1:8545` *(the `http://` prefix is required — without it MetaMask shows &ldquo;Could not fetch chain ID&rdquo;)*
   - Chain ID: `31337`
   - Currency: `ETH`
   - Block explorer: leave blank
   - Expected MetaMask warnings: it suggests &ldquo;GoChain Testnet&rdquo; / currency `GO`. Chain ID 31337 happens to collide with that entry in MetaMask&rsquo;s public chain registry — the warning is cosmetic and safe to ignore for local Anvil.
2. **Import the user account:** account menu → Import account → paste:
   ```
   0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
   ```
   The address should resolve to `0x7099…79C8`.
3. **Switch the network selector to Anvil.** This is the single most common papercut — if MetaMask is on Ethereum mainnet when you click "Set policy", you'll see "Insufficient funds" because your imported account only has ETH on the local chain. Switch to Anvil and try again.

### Walk the onboarding

In the web UI:

1. **Connect wallet** → pick the imported anvil user.
2. **Set policy** → Confirm in MetaMask. Defaults are correct (max 100/tx, total 500, 24h, agent `0x3C44…93BC`, allowlist Merchants A and B).
3. **Mint 1000 USDC** → Confirm.
4. **Approve** → Confirm.
5. **Deposit 500 USDC** → Confirm.

After step 5, the balance strip should show:

| Cell | Value |
|---|---|
| User | 500.00 USDC |
| Vault | 500.00 USDC |
| Agent | 0.00 USDC |
| Merchants A/B/C | 0.00 each |

Top bar should show `policy v1 · remaining: 500.00 / 100.00 per-tx`.

### Fund the vulnerable agent (Tab 2)

The vulnerable agent runs from a session wallet that has zero USDC by default. Mint to it so its lane can demonstrate "money moves with no oversight":

```sh
cast send 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  "mint(address,uint256)" \
  0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC 500000000 \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

The Agent cell should tick to 500.00 USDC within 3 seconds (auto-refresh).

**Tier 2 done.** The UI is fully wired; you can stop here if you don't have an OpenAI key. The Run buttons will stream LLM-related errors but everything else works.

---

## Tier 3 — Run both agents (~2 minutes)

### Get an OpenAI key

1. Visit https://platform.openai.com/api-keys → create a new key.
2. **Set a hard usage cap.** https://platform.openai.com/settings/organization/limits → Usage limit → $5 hard cap. A demo run costs <$0.01; the cap is just insurance against runaway loops.
3. In Tab 3, stop the dev server (`Ctrl+C`).
4. Edit `web/.env.local` and replace `OPENAI_API_KEY=sk-leave-blank-for-tier-2` with your real key.
5. Restart: `pnpm -F @safespend/web dev`.
6. Hard-refresh the browser tab (Cmd+Shift+R).

### Vulnerable lane

Click **Run** on the rose Vulnerable panel. Expected transcript:

```
[tool→] searchListings({})
[tool←] searchListings → [3 listings]
[tool→] proposePurchase({"listingId":"listing_bait_c", ..., "amount":"12000000"})
[tool←] proposePurchase → {"ok":true, "mode":"vulnerable", "status":"transferred", "txHash":"0x..."}
[final] Purchased ... for $12.00
```

Expected balance changes:
- **Merchant C cell:** 0.00 → 12.00 USDC
- **Agent cell:** drops by 12 USDC
- **On-chain event feed:** unchanged. The vulnerable lane bypasses the vault — money moves but leaves no record.

### Safe lane

Click **Run** on the emerald Safe panel. Expected transcript:

```
[tool→] searchListings({})
[tool←] searchListings → [3 listings]
[tool→] proposePurchase({"listingId":"listing_bait_c", ..., "amount":"12000000"})
[tool←] proposePurchase → {"ok":false, "mode":"safe", "status":"rejected", "reason":"merchant_not_allowed", "txHash":"0x..."}
[final] Could not purchase: vault rejected the merchant
```

Expected balance changes:
- **No balances move.** Vault refused the transfer.
- **On-chain event feed:** new entry `✗ Rejected · Merchant not allowed`.

That's the punchline: **the agent fell for the same prompt-injection both times. Only the lane wired through `PolicyVault` is still solvent.**

If the safe agent picks Merchant A instead of C, the LLM was too cautious to fall for the bait. The on-chain rejection path is still proven by the unit tests (`test_TryProposePurchase_EmitsRejectedReason`); for a live demo you can either narrate it that way or strengthen the bait further in `agent/src/listings.json` (drop the price, add urgency).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `command not found: forge` | foundryup ran but PATH not reloaded | `source ~/.zshenv && foundryup`, or open a new terminal |
| `command not found: #` (zsh) | Comments treated as commands | Strip the `# ...` lines, or `setopt interactive_comments` once per shell |
| MetaMask "Insufficient funds — not enough ETH for network fees", fee shown in real $ | MetaMask is on Ethereum mainnet | Switch the network selector to Anvil |
| MetaMask: "Could not fetch chain ID. Is your RPC URL correct?" | RPC URL missing `http://` prefix, or anvil not reachable | Use `http://127.0.0.1:8545` (not `127.0.0.1:8545`, not `localhost:8545`). Or use the in-page **Add / switch to Anvil** button. |
| MetaMask warns the network name "may not match" / suggests "GoChain Testnet" / suggests currency `GO` | Chain ID 31337 collides with GoChain Testnet in MetaMask's chain registry | Cosmetic. Save the network anyway — local Anvil uses ETH, not GO. |
| MetaMask shows 0 ETH on Anvil even though anvil pre-funds it | Stale nonce cache after anvil restart | MetaMask → Settings → Advanced → Clear activity and nonce data |
| OpenAI returns `model_not_found` / `does not exist or you do not have access` | `OPENAI_MODEL` is set to a model your account can't reach | Use `gpt-4o-mini` (cheap, broadly available, supports tool calling) |
| Vulnerable run shows `status: reverted` with "transfer reverted" | Agent wallet has 0 MockUSDC | Run the `cast send` mint to `0x3C44…93BC` |
| Web shows `policy v0` and `remaining: 0.00 / 0.00` after connecting | Policy not set yet | Click "Set policy" and confirm in MetaMask |
| `pnpm anvil` errors about port in use | Another anvil already running | `pkill anvil` then retry |
| `.env.local` change doesn't take effect | Next.js loads env at boot, not on file change | Stop and restart `pnpm -F @safespend/web dev`, then hard-refresh the browser |
| `forge install` complains about uncommitted changes | Pre-existing modifications in `contracts/lib/` | `cd contracts && git submodule update --init --recursive` |

---

## What's next

- For the public-explorer demo on Avalanche Fuji testnet, see [docs/fuji-deploy.md](fuji-deploy.md).
- For the full architectural spec and contract semantics, see [docs/24-hour-build-plan.md](24-hour-build-plan.md).
