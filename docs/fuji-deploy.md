# Fuji deploy runbook

End-to-end on Avalanche Fuji testnet (chain id `43113`). Closes G3 — two block-explorer links: one `PurchaseApproved`, one `PurchaseRejected`, same user, same policy version.

You'll do this once before the demo. The whole thing is ~5 minutes if the faucet cooperates.

## What you need

1. **A fresh dev EOA.** Generate one with `cast wallet new` or use any throwaway dev key. Don't use a real-money key — this script broadcasts with it.
2. **Testnet AVAX in that EOA.** Open the [Avalanche Fuji faucet](https://core.app/tools/testnet-faucet/?subnet=c&token=c), paste the EOA's address, click Request. ~10 seconds. You'll get 2 testnet AVAX, way more than enough (deploy + seed costs about 0.05 AVAX).
3. **MetaMask connected to Fuji** for the demo USER role. Either add Fuji manually (chain id `43113`, RPC `https://api.avax-test.network/ext/bc/C/rpc`, explorer `https://testnet.snowtrace.io`) or just pick "Avalanche Fuji" from the network list if it's there.
4. **An OpenAI API key** in `.env.local` for the web's `/api/run` route.

## Steps

### 1. Deploy

```sh
export DEPLOYER_PRIVATE_KEY=0x...   # the fresh, faucet-funded key
pnpm fuji:deploy
```

What it does:
- Runs `forge script Deploy.s.sol --broadcast` against Fuji.
- Parses the deployed `MockUSDC` and `PolicyVault` addresses out of the broadcast artifact.
- Rewrites the `43113` entry in `shared/src/addresses.ts`.
- Prints the explorer URLs for both contracts.

### 2. Set the policy (web UI)

```sh
pnpm -F @safespend/web dev
```

In the browser:
1. Connect MetaMask to your demo USER address (anything other than the deployer).
2. Click **Set policy**. Defaults are sensible (max per tx 100 USDC, total 500 USDC, agent address pre-filled to anvil-style account #2 — change it to your actual server-side agent EOA before deploying for real).
3. Walk the rest of onboarding: **Mint MockUSDC** → **Approve vault** → **Deposit 500 USDC**.

The policy version, remaining allowance, and balance strip should all update live.

### 3. Top up the vulnerable session wallet

```sh
export AUTHORIZED_AGENT_ADDRESS=0x...   # the agent EOA in your .env / web env
pnpm fuji:seed
```

This mints 500 MockUSDC directly to the agent address so the **vulnerable** run has something to spend without going through the vault. The DEPLOYER_PRIVATE_KEY env from step 1 is still used here (deployer is the MockUSDC minter).

### 4. Capture the two explorer links

Click **Run** on the **Vulnerable agent** panel. It will try to send to the bad merchant; the transaction goes through, the agent's wallet drops by 50 USDC, and the bad merchant's balance ticks up. Copy that tx hash from the panel into `https://testnet.snowtrace.io/tx/<hash>` if you want a deep link.

Click **Run** on the **Safe agent** panel. The agent calls `tryProposePurchase` against the vault; the vault rejects with `merchant_not_allowed`. The PurchaseRejected event lands in the on-chain feed. Grab the tx hash for the explorer link.

You now have:
- A `PurchaseRejected` link (safe mode caught the injection).
- A vulnerable-mode `Transfer` link or a successful `PurchaseApproved` for the clean listing on the safe side.

### 5. (Optional) Same-user approved + rejected on the same policy version

Run the **safe** agent with one merchant from the allowlist (Merchant A, clean listing) — that gives you a `PurchaseApproved` event. Run it again pointing at Merchant C (you can edit `agent/src/listings.json` if needed) — `PurchaseRejected` with `merchant_not_allowed`. Both events share the same `policyVersion`, which is what G3 wants you to demonstrate.

## Troubleshooting

- **`DEPLOYER_PRIVATE_KEY is not set`**: export it in the same shell as `pnpm fuji:deploy`.
- **`InsufficientFunds`**: the deployer EOA needs more testnet AVAX. Faucet again.
- **Forge can't find the broadcast artifact**: re-run `pnpm fuji:deploy` — the previous run may have errored before broadcasting. Check the script's stderr.
- **Web shows the wrong chain**: switch MetaMask to Fuji. The TopBar reads `chainId` from the connected wallet; addresses are pulled from `shared/addresses.ts` accordingly.
- **`/api/run` fails with `Missing required env var: PRIVATE_KEY`**: the web's `.env.local` needs the agent EOA's private key (server-side only) and `OPENAI_API_KEY`. See `.env.example`.
- **`forge install` issues**: only matters for first-time setup; not part of the deploy flow.

## What's deliberately not automated

- **Setting the user's policy.** That's a wallet signature from the demo USER, not the deployer. The web UI is the right place for it; doing it from a script would mean stashing the user's key, which we don't want.
- **Funding the safe-mode user.** Same reason — they sign their own deposit through the UI.
- **Verifying the contract source on Snowtrace.** Optional and adds API-key dependencies. Add it later if the demo needs the source viewable on the explorer.
