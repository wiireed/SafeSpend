export type Address = `0x${string}`;
export type Hex = `0x${string}`;

/// Mirrors the on-chain `Policy` struct in PolicyVault.sol.
export type Policy = {
  maxPerTx: bigint;
  maxTotal: bigint;
  expiresAt: bigint;
  authorizedAgent: Address;
  version: bigint;
  allowedMerchants: Address[];
};

/// Mirrors the on-chain `PolicyInput` struct (no version; assigned by the contract).
export type PolicyInput = {
  maxPerTx: bigint;
  maxTotal: bigint;
  expiresAt: bigint;
  authorizedAgent: Address;
  allowedMerchants: Address[];
};

export const REASON_CODES = [
  "merchant_not_allowed",
  "exceeds_per_tx",
  "exceeds_total",
  "policy_expired",
  "no_policy",
  "insufficient_deposit",
  "unauthorized_agent",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export type ChainListing = {
  id: string;
  merchant: Address;
  amount: bigint;
  title: string;
};
