/// Display-only ENS labels for our demo merchants. Keys are lowercased
/// addresses; values are the human-readable name shown in BalanceStrip.
///
/// We don't reverse-resolve via mainnet because we control these addresses
/// and they don't have ENS primary names set. The map IS the override.
///
/// Source of truth for the ENS strings is agent/src/listings.json's
/// `merchantEns` field — keep these in sync after any registration.

import { ANVIL_ACCOUNTS } from "@safespend/sdk/addresses";

export const MERCHANT_ENS: Record<string, string> = {
  [ANVIL_ACCOUNTS.merchantA.toLowerCase()]: "merchant-a.safespend.eth",
  [ANVIL_ACCOUNTS.merchantB.toLowerCase()]: "merchant-b.safespend.eth",
  // merchantC stays anonymous on purpose — the bait should look raw.
};
