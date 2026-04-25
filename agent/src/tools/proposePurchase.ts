/// Tool: proposePurchase. Safe vs vulnerable branch lives here. Wired in PR 3.
import type { LlmToolSchema } from "../llm/index.js";

export const proposePurchaseSchema: LlmToolSchema = {
  name: "proposePurchase",
  description: "Propose a purchase from a merchant. The wallet decides whether it executes.",
  parameters: {
    type: "object",
    properties: {
      merchant: { type: "string", description: "EVM address of the merchant" },
      amount: { type: "string", description: "Amount in MockUSDC base units (6 decimals)" },
      listingId: { type: "string", description: "Stable id from searchListings" },
    },
    required: ["merchant", "amount", "listingId"],
    additionalProperties: false,
  },
};

export type ProposePurchaseMode = "safe" | "vulnerable";

export async function proposePurchase(_input: {
  mode: ProposePurchaseMode;
  merchant: string;
  amount: string;
  listingId: string;
}): Promise<string> {
  throw new Error("proposePurchase: implementation lands in PR 3");
}
