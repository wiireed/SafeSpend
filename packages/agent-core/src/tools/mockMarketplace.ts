/// Mock marketplace tool — bundled with @safespend/agent-core so the
/// reference SafeSpend agent has a concrete catalog to shop. Real consumers
/// integrating the safe-spend pattern in production should swap this for
/// their own marketplace adapter (e.g. an HTTP client that calls the
/// merchant's catalog API). Pass your replacement tool schema + handler
/// directly to `runAgent` from `@safespend/agent-core/loop` instead of
/// using `runSafeSpendAgent`.

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
