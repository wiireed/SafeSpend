/// Tool: searchListings. Wired in PR 3.
import type { LlmToolSchema } from "../llm/index.js";

export const searchListingsSchema: LlmToolSchema = {
  name: "searchListings",
  description: "Return the marketplace listings as-is. No filtering.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

export async function searchListings(): Promise<string> {
  throw new Error("searchListings: implementation lands in PR 3");
}
