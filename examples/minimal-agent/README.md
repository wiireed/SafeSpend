# minimal-agent

Smallest possible [`@safespend/sdk`](../../packages/sdk) integration. Proposes one purchase against a deployed `PolicyVault` and prints the result.

**No React. No LLM. No agent loop.** Just viem through the SDK. This example exists to prove the SDK is framework-agnostic — a downstream project can adopt the safe-spend on-chain pattern without inheriting any of our other choices.

```ts
import { createVaultClient, computeListingHash, proposePurchase } from "@safespend/sdk";

const clients = createVaultClient({ chainId, rpcUrl, privateKey });

const result = await proposePurchase({
  clients,
  vaultAddress,
  userAddress,
  merchant,
  amount: 5_000_000n,        // 5 USDC, 6 decimals
  listingHash: computeListingHash({ merchant, amount: 5_000_000n, listingId: "..." }),
});

// result.status: "approved" | "rejected" | "reverted" | "no_event"
```

## Run it

1. **Have a deployed vault.** Easiest: spin up the local Anvil + deploy + seed flow from the repo root:
   ```sh
   docker compose up
   ```
   Or manually:
   ```sh
   pnpm anvil                                   # terminal 1
   pnpm contracts:build
   forge script packages/contracts/script/Deploy.s.sol --root packages/contracts \
     --rpc-url http://127.0.0.1:8545 \
     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
     --broadcast
   ```

2. **Set a policy.** Open the merchant app at http://localhost:3000 and walk the onboarding flow (set policy → mint USDC → approve vault → deposit). The policy must authorize the agent EOA from your `.env` and allowlist `MERCHANT_ADDRESS`.

3. **Set env vars** (or copy `.env.example`):
   ```sh
   export CHAIN_ID=31337
   export RPC_URL=http://127.0.0.1:8545
   export PRIVATE_KEY=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
   export USER_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
   export VAULT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
   export MERCHANT_ADDRESS=0x90F79bf6EB2c4f870365E785982E1f101E93b906
   ```

4. **Run:**
   ```sh
   pnpm --filter @safespend/example-minimal-agent start
   ```

   On success:
   ```
   Proposing purchase: user=0x7099… merchant=0x90F7… amount=5000000 listingId=minimal-example-listing-1
   Result: { "ok": true, "status": "approved", "txHash": "0x…" }

   ✓ Vault approved the purchase.
   ```

## Surface guard

This example only imports from `@safespend/sdk`, `viem`, `dotenv`. No React, no `@anthropic-ai/sdk`, no `openai`. Verify:

```sh
grep -rE 'from "react"|from "@safespend/react"|from "@safespend/agent-core"|from "openai"|from "@anthropic-ai"' index.ts
# (no matches)
```
