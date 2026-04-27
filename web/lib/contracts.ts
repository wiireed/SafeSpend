/// Re-exports of contract metadata so components import from one place.
import type { Abi } from "viem";
import policyVaultAbiJson from "@safespend/sdk/abis/PolicyVault.json" with { type: "json" };
import mockUsdcAbiJson from "@safespend/sdk/abis/MockUSDC.json" with { type: "json" };
import { ADDRESSES, ANVIL_ACCOUNTS } from "@safespend/sdk/addresses";

export const policyVaultAbi = policyVaultAbiJson as Abi;
export const mockUsdcAbi = mockUsdcAbiJson as Abi;

export { ADDRESSES, ANVIL_ACCOUNTS };

export const REASON_CODE_LABELS: Record<string, string> = {
  merchant_not_allowed: "Merchant not allowed",
  exceeds_per_tx: "Exceeds per-tx limit",
  exceeds_total: "Exceeds total budget",
  policy_expired: "Policy expired",
  no_policy: "No policy set",
  insufficient_deposit: "Insufficient deposit",
};
