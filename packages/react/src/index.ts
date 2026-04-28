/// Public surface for @safespend/react. All hooks return plain data;
/// none render JSX or assume a styling library. Pair with your own
/// styled components.

export { useEnsLabel } from "./hooks/useEnsLabel.js";
export {
  useVaultEvents,
  type VaultFeedEntry,
  type UseVaultEventsOptions,
} from "./hooks/useVaultEvents.js";
export {
  useVaultBalances,
  type UseVaultBalancesOptions,
} from "./hooks/useVaultBalances.js";
export {
  useAgentRun,
  type AgentRunStatus,
  type UseAgentRunOptions,
} from "./hooks/useAgentRun.js";
export {
  useNetworkSwitcher,
  type ChainSpec,
  type UseNetworkSwitcherResult,
} from "./hooks/useNetworkSwitcher.js";
export { usePolicy, type Policy } from "./hooks/usePolicy.js";
export {
  usePolicySetter,
  type PolicyInput,
} from "./hooks/usePolicySetter.js";
export {
  useVaultActivityHistory,
  type VaultActivityEntry,
  type UseVaultActivityHistoryOptions,
} from "./hooks/useVaultActivityHistory.js";
