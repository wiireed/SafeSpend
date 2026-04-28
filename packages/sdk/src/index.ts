export * from "./types.js";
export { explorerTxUrl, explorerAddressUrl, type SupportedChainId } from "./explorer.js";

/// Vault primitives — chain client factory, ENS helpers, spend tx-builder,
/// policy reader / writer.
export * from "./chain.js";
export * from "./ens.js";
export * from "./spend.js";
export { getPolicy, setPolicy } from "./policy.js";

/// Re-export contract metadata for ergonomics. @safespend/contracts is the
/// source of truth; consumers may also import directly from there.
export {
  ADDRESSES,
  getAddresses,
  type DeployedAddresses,
} from "@safespend/contracts/addresses";
