# @safespend/contracts

Chain-truth layer for SafeSpend: Solidity contracts (`PolicyVault`, `MockUSDC`), JSON ABIs, typed `as const` ABI fragments, and deployed addresses keyed by chain id.

This is the only package in the SafeSpend split that has zero TypeScript dependencies on the rest of the workspace. Other packages (`@safespend/sdk`, `@safespend/agent-core`, `@safespend/react`) all depend on it for contract metadata.

## Exports

```ts
import { policyVaultAbi, mockUsdcAbi } from "@safespend/contracts/abi";       // typed `as const`
import policyVaultAbiJson from "@safespend/contracts/abis/PolicyVault.json";  // runtime JSON
import mockUsdcAbiJson   from "@safespend/contracts/abis/MockUSDC.json";
import { ADDRESSES, getAddresses, type SupportedChainId } from "@safespend/contracts/addresses";
import * as everything from "@safespend/contracts";  // root: addresses + abi
```

| Subpath | Purpose |
|---|---|
| `./abi` | Typed `as const` fragments — preferred for type-safe viem calls |
| `./abis/PolicyVault.json`, `./abis/MockUSDC.json` | Full runtime JSON ABIs (used by the merchant frontend for event decoding) |
| `./addresses` | `ADDRESSES`, `getAddresses(chainId)`, `SupportedChainId`, `DeployedAddresses` |
| `.` (root) | Re-exports `./addresses` and `./abi` |

## Solidity sources

- [`src/PolicyVault.sol`](src/PolicyVault.sol) — the policy engine + vault custody.
- [`src/MockUSDC.sol`](src/MockUSDC.sol) — 6-decimal ERC-20 with public `mint`, demo only.
- [`test/PolicyVault.t.sol`](test/PolicyVault.t.sol) — 23 Foundry tests covering the full policy matrix.
- [`script/Deploy.s.sol`](script/Deploy.s.sol) — deploys MockUSDC then PolicyVault pinned to it.
- [`script/Seed.s.sol`](script/Seed.s.sol) — funds both demo lanes with 500 USDC.

`packages/contracts/` is a Foundry project, **not** part of the pnpm workspace's TS build. The TS bits (`addresses.ts`, `abi.ts`, the `abis/*.json` files) live alongside it for convenience.

## Building + testing

From the repo root:

```sh
pnpm contracts:build      # forge build
pnpm contracts:test       # forge test (23 tests)
pnpm abis:export          # rebuild + sync abis/*.json from forge artefacts
```

Or directly:

```sh
forge build --root packages/contracts
forge test  --root packages/contracts -vv
```

## Adding a new chain

1. `forge script` deploy `MockUSDC` + `PolicyVault` on the chain.
2. Add the new chain id to `SupportedChainId` in [`src/addresses.ts`](src/addresses.ts).
3. Add an entry under `ADDRESSES`.
4. (Mirror the chain id in [`packages/sdk/src/explorer.ts`](../sdk/src/explorer.ts) and [`packages/sdk/src/chain.ts`](../sdk/src/chain.ts)'s `pickChain`.)

See [`../../docs/contracts/new-chain-deploy.md`](../../docs/contracts/new-chain-deploy.md) for the full runbook.

## Demo data

`ANVIL_ACCOUNTS` and `ANVIL_PRIVATE_KEYS` are **not** part of this package. They're well-known anvil mnemonic fixtures and live in [`apps/merchant/lib/anvil.ts`](../../apps/merchant/lib/anvil.ts) for the reference web app.
