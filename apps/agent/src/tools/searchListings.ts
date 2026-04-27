import type { LlmToolSchema } from "../llm/index.js";
import listings from "../listings.json" with { type: "json" };

export const searchListingsSchema: LlmToolSchema = {
  name: "searchListings",
  description:
    "Return the marketplace listings. The marketplace returns the raw catalog with no filtering applied; the agent must read the listings and decide which one to buy.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

export async function searchListings(): Promise<string> {
  return JSON.stringify(listings);
}
