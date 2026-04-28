/// Server-side PolicyVault policy reads + writes. The merchant frontend
/// uses the wagmi-flavoured equivalents from @safespend/react instead;
/// this module is for CLI scripts, automated deployments, and tests.

import type { Hex } from "viem";
import { policyVaultAbi } from "@safespend/contracts/abi";
import type { VaultClients } from "./chain.js";
import type { Policy, PolicyInput } from "./types.js";

export type { Policy, PolicyInput };

/// Read a user's current policy. The contract returns a zero-version
/// policy for users who've never called setPolicy; check `policy.version
/// === 0n` to detect that.
export async function getPolicy(args: {
  clients: VaultClients;
  vaultAddress: Hex;
  user: Hex;
}): Promise<Policy> {
  const result = await args.clients.publicClient.readContract({
    address: args.vaultAddress,
    abi: policyVaultAbi,
    functionName: "getPolicy",
    args: [args.user],
  });
  return {
    maxPerTx: result.maxPerTx,
    maxTotal: result.maxTotal,
    expiresAt: result.expiresAt,
    authorizedAgent: result.authorizedAgent,
    version: BigInt(result.version),
    allowedMerchants: [...result.allowedMerchants],
  };
}

/// Submit a setPolicy transaction. Returns the tx hash; caller waits for
/// the receipt if it cares about confirmation. The on-chain `PolicySet`
/// event records the policy version that was assigned.
export async function setPolicy(args: {
  clients: VaultClients;
  vaultAddress: Hex;
  input: PolicyInput;
}): Promise<Hex> {
  return args.clients.walletClient.writeContract({
    address: args.vaultAddress,
    abi: policyVaultAbi,
    functionName: "setPolicy",
    args: [
      {
        maxPerTx: args.input.maxPerTx,
        maxTotal: args.input.maxTotal,
        expiresAt: args.input.expiresAt,
        authorizedAgent: args.input.authorizedAgent,
        allowedMerchants: args.input.allowedMerchants,
      },
    ],
    account: args.clients.account,
    chain: args.clients.chain,
  });
}
