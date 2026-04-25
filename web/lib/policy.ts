/// Wallet-side policy transactions (setPolicy, deposit, etc.). Wired in PR 4.
import type { PolicyInput } from "@safespend/shared/types";

export type SetPolicyArgs = PolicyInput;

export async function setPolicy(_args: SetPolicyArgs): Promise<`0x${string}`> {
  throw new Error("setPolicy: implementation lands in PR 4");
}
