import type { Hex } from "viem";

export type PolicyInput = {
  maxPerTx: bigint;
  maxTotal: bigint;
  expiresAt: bigint;
  authorizedAgent: Hex;
  allowedMerchants: Hex[];
};

export type Policy = PolicyInput & { version: bigint };
