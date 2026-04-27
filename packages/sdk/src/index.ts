export * from "./types.js";
export { explorerTxUrl, explorerAddressUrl, type SupportedChainId } from "./explorer.js";

/// Re-export contract metadata for ergonomics. @safespend/contracts is the
/// source of truth; consumers may also import directly from there.
export {
  ADDRESSES,
  getAddresses,
  type DeployedAddresses,
} from "@safespend/contracts/addresses";
