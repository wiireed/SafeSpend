/// Smallest possible @safespend/sdk integration.
///
/// Connects to a deployed PolicyVault, proposes a purchase, and prints
/// the structured result. No React, no LLM, no agent loop — just viem
/// through the SDK. Proves the SDK is framework-agnostic and a downstream
/// project can wire safe-spend on-chain logic without inheriting our
/// LLM choices.
///
/// Run against local Anvil:
///   1. `pnpm anvil` (in another terminal)
///   2. `pnpm contracts:build && pnpm --filter @safespend/agent start --safe`
///      once first to deploy + seed (or use the docker-compose setup).
///   3. Set the env vars below and `pnpm --filter @safespend/example-minimal-agent start`.
///
/// Required env (set via .env or shell):
///   CHAIN_ID            31337 (Anvil) or 43113 (Fuji).
///   RPC_URL             http://127.0.0.1:8545 for Anvil.
///   PRIVATE_KEY         The authorized agent's private key from the policy.
///   VAULT_ADDRESS       PolicyVault address (deployment artefact).
///   USER_ADDRESS        The user whose policy authorizes this spend.
///   MERCHANT_ADDRESS    A merchant that's allowlisted in the policy.

import "dotenv/config";
import type { Hex } from "viem";
import {
  createVaultClient,
  computeListingHash,
  proposePurchase,
} from "@safespend/sdk";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(2);
  }
  return v;
}

async function main(): Promise<void> {
  const config = {
    chainId: parseInt(requireEnv("CHAIN_ID"), 10),
    rpcUrl: requireEnv("RPC_URL"),
    privateKey: requireEnv("PRIVATE_KEY") as Hex,
    vaultAddress: requireEnv("VAULT_ADDRESS") as Hex,
    userAddress: requireEnv("USER_ADDRESS") as Hex,
    merchantAddress: requireEnv("MERCHANT_ADDRESS") as Hex,
  };

  const clients = createVaultClient({
    chainId: config.chainId,
    rpcUrl: config.rpcUrl,
    privateKey: config.privateKey,
  });

  const amount = 5_000_000n; // 5 USDC, 6 decimals
  const listingId = "minimal-example-listing-1";
  const listingHash = computeListingHash({
    merchant: config.merchantAddress,
    amount,
    listingId,
  });

  console.log(
    `Proposing purchase: user=${config.userAddress} merchant=${config.merchantAddress} amount=${amount} listingId=${listingId}`,
  );

  const result = await proposePurchase({
    clients,
    vaultAddress: config.vaultAddress,
    userAddress: config.userAddress,
    merchant: config.merchantAddress,
    amount,
    listingHash,
  });

  console.log("Result:", JSON.stringify(result, null, 2));

  if (result.status === "approved") {
    console.log("\n✓ Vault approved the purchase.");
    process.exit(0);
  }
  if (result.status === "rejected") {
    console.log(`\n✗ Vault rejected: ${result.reason}`);
    process.exit(1);
  }
  if (result.status === "reverted") {
    console.log(`\n✗ Tx reverted: ${result.detail}`);
    process.exit(1);
  }
  console.log("\n? No vault event in receipt.");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
