# Deploying SafeSpend to a new EVM chain

This is the step-by-step you'd follow to bring SafeSpend up on a chain that isn't already wired in (currently Anvil at `31337` and Avalanche Fuji at `43113`). The contracts themselves are chain-agnostic — they're plain Solidity 0.8.24 against an ERC-20 — so the work is configuration plumbing, not contract changes.

If you only want to deploy to **Fuji**, the existing one-command path is `pnpm fuji:deploy`; see [`docs/fuji-deploy.md`](../fuji-deploy.md). This document is for any *new* chain — Sepolia, Base Sepolia, Arbitrum testnet, a private L2, etc.

> **Mainnet warning.** This codebase is a hackathon prototype. The contracts are tested but not audited. Do not deploy to a real-money chain without a formal audit. The instructions below assume a testnet.

## Decisions to make first

Before running any commands, decide three things:

### 1. What ERC-20 will the vault hold?

The vault's `usdc` field is `immutable` and set in the constructor ([`PolicyVault.sol:18`](../../contracts/src/PolicyVault.sol)). It cannot be changed after deploy. You have three options:

- **Deploy a fresh `MockUSDC`** alongside the vault. Easiest for testnets. The current Anvil and Fuji deployments do this.
- **Point at the chain's canonical USDC.** Real-world option; Circle publishes USDC addresses for all major chains. Skip the `MockUSDC` deployment in `Deploy.s.sol`.
- **Point at a different stablecoin.** Same shape, but the demo's "USDC" branding will be misleading. Probably rename the field to `token` if you do this often.

For testnets, `MockUSDC` is fine. The cost is one extra ~700 k-gas deploy.

### 2. What chain id will you support?

The chain id needs to flow through three places:

- **`shared/src/explorer.ts`** — add to `SupportedChainId` and `EXPLORERS` map.
- **`shared/src/addresses.ts`** — add a new entry under `ADDRESSES`.
- **`agent/src/chain.ts`** — add a `pickChain` case so viem maps the id to a `Chain` object.
- **`web/lib/wagmi.ts`** — add the chain to wagmi's config so MetaMask can connect.

This is the bulk of the wiring work for a new chain. About 10 lines per file.

### 3. What's the agent EOA?

The agent address is configured **per-deployment, not per-chain**. You can use a different agent EOA on every chain if you like, but in practice you probably want one agent server that can spend on whichever chain the user is on, and you set the right address in the user's policy at `setPolicy` time. The agent EOA does *not* go in the deploy script — only the depositor sets it.

For the demo seed script, the agent address is read from `AUTHORIZED_AGENT_ADDRESS` env. See [`Seed.s.sol:26`](../../contracts/script/Seed.s.sol).

## The deploy itself

The Solidity side is identical for any chain. From the repo root:

```sh
export DEPLOYER_PRIVATE_KEY=0x...   # funded EOA on the target chain
export TARGET_RPC_URL=https://...   # RPC endpoint for the target chain
forge script contracts/script/Deploy.s.sol \
  --root contracts \
  --rpc-url "$TARGET_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  --slow
```

Key flags:

- `--root contracts` — the foundry project lives in a subdirectory; this points forge at it.
- `--broadcast` — actually send the transactions. Without it, forge does a dry-run.
- `--slow` — wait for each tx to confirm before sending the next, so the broadcast artifact is reliable. Drop on chains with very fast finality if you're confident.

What gets deployed ([`Deploy.s.sol`](../../contracts/script/Deploy.s.sol)):

```solidity
function run() external returns (MockUSDC usdc, PolicyVault vault) {
    vm.startBroadcast();
    usdc = new MockUSDC();
    vault = new PolicyVault(usdc);
    vm.stopBroadcast();

    console2.log("MockUSDC:    ", address(usdc));
    console2.log("PolicyVault: ", address(vault));
}
```

Two contracts. The vault's constructor argument is the freshly-deployed `MockUSDC` address. Total gas: ~3M, dominated by the vault.

After it broadcasts successfully, the addresses are in the broadcast artifact:

```sh
contracts/broadcast/Deploy.s.sol/<chainId>/run-latest.json
```

with `transactions[*].contractName` and `transactions[*].contractAddress`. The Fuji helper script ([`scripts/deploy-fuji.sh`](../../scripts/deploy-fuji.sh)) parses this with `jq` and pipes into `update-fuji-addresses.mjs`. For a new chain, you'd write a similar two-line shell script or just paste the addresses by hand.

## Wiring the new chain into the codebase

Once you have `<USDC_ADDRESS>` and `<VAULT_ADDRESS>` for chain id `<CHAIN_ID>`, four edits:

### A. `shared/src/explorer.ts`

```ts
export type SupportedChainId = 31337 | 43113 | <CHAIN_ID>;

const EXPLORERS: Record<number, string | null> = {
  31337: null,
  43113: "https://testnet.snowtrace.io",
  <CHAIN_ID>: "https://<explorer-host>",      // or null if no explorer
};
```

Without this, `explorerTxUrl` and `explorerAddressUrl` return `null` and the UI's "view on Snowtrace" links are missing. Not load-bearing but a quality regression.

### B. `shared/src/addresses.ts`

```ts
export const ADDRESSES: Record<SupportedChainId, DeployedAddresses> = {
  31337: { /* ... */ },
  43113: { /* ... */ },
  <CHAIN_ID>: {
    usdc:  "<USDC_ADDRESS>",
    vault: "<VAULT_ADDRESS>",
  },
};
```

This is the lookup table the agent and the web app both read. `getAddresses(chainId)` will throw on unsupported chains — adding the entry is what enables the chain.

### C. `agent/src/chain.ts`

```ts
import { foundry, avalancheFuji, sepolia } from "viem/chains";   // add the import

function pickChain(chainId: number): Chain {
  if (chainId === foundry.id) return foundry;
  if (chainId === avalancheFuji.id) return avalancheFuji;
  if (chainId === sepolia.id) return sepolia;                    // add the case
  throw new Error(`Unsupported chainId=${chainId}`);
}
```

If your target chain isn't already in `viem/chains`, you can build a `Chain` object inline — see viem's `defineChain` helper. Common testnets (Sepolia, Base Sepolia, Optimism Sepolia, Arbitrum Sepolia) are already in viem.

### D. `web/lib/wagmi.ts`

Add the chain to wagmi's chain list and connector config. This is what tells MetaMask "I support chain X" and what RainbowKit / WalletConnect display in the network switcher.

## Funding the demo on the new chain

If you want the four-step onboarding flow to work on the new chain, you need:

1. **The demo USER address has gas on the new chain** — to sign `setPolicy`, `approve`, `deposit`. Faucet the test chain's native token to that EOA.
2. **The agent EOA has gas on the new chain** — to sign `tryProposePurchase`. Same faucet step.
3. **(Vulnerable lane)** The agent EOA has `MockUSDC` directly in its wallet. Use `usdc.mint(agent, amount)` from the deployer.

The seed script ([`Seed.s.sol`](../../contracts/script/Seed.s.sol)) does steps 2-style preparation but is hard-coded to mint with the deployer key. Edit env vars and re-run:

```sh
export USDC_ADDRESS=<USDC_ADDRESS>
export VAULT_ADDRESS=<VAULT_ADDRESS>
export USER_ADDRESS=<demo user EOA>
export AUTHORIZED_AGENT_ADDRESS=<agent EOA>

forge script contracts/script/Seed.s.sol \
  --root contracts \
  --rpc-url "$TARGET_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast
```

Note the same precondition the contracts enforce: **the user must have a policy first.** The seed script's `depositFor(user, ...)` will revert with `NoPolicy` otherwise. Run the web onboarding's step 1 before invoking the seed.

## Verifying source on the new chain's explorer

Source verification is chain-specific. Two common paths:

- **Sourcify** — works on most chains automatically. Run from `contracts/`:

  ```sh
  forge verify-contract --chain <chainId> \
    --verifier sourcify \
    <ADDRESS> src/PolicyVault.sol:PolicyVault
  ```

- **Etherscan-family explorers (Snowtrace, Basescan, etc.)** — need an API key:

  ```sh
  export ETHERSCAN_API_KEY=<key>
  forge verify-contract --chain <chainId> \
    <ADDRESS> src/PolicyVault.sol:PolicyVault \
    --constructor-args $(cast abi-encode "constructor(address)" <USDC_ADDRESS>)
  ```

The constructor argument matters for the vault — getting it wrong causes verification to fail. `MockUSDC` has no constructor args.

## A minimal smoke test for the new chain

Once everything is wired, a 60-second smoke check:

```sh
# 1. The vault answers basic reads
cast call <VAULT> "usdc()(address)"        --rpc-url "$TARGET_RPC_URL"
cast call <VAULT> "MAX_ALLOWLIST()(uint256)" --rpc-url "$TARGET_RPC_URL"

# 2. Deposit-without-policy reverts (this is the smoke test for the policy gate)
cast send <USDC>  "mint(address,uint256)" <USER> 1000000000  \
  --rpc-url "$TARGET_RPC_URL" --private-key <DEPLOYER>
cast send <USDC>  "approve(address,uint256)" <VAULT> 1000000000 \
  --rpc-url "$TARGET_RPC_URL" --private-key <USER>
cast send <VAULT> "deposit(uint256)" 100000000 \
  --rpc-url "$TARGET_RPC_URL" --private-key <USER>
# Expect: revert with "NoPolicy" (selector 0x...). If this succeeds you've
# pointed the vault at the wrong contract bytecode.
```

Then run the web app, set a policy, and re-run the deposit. It should succeed.

## What changes between testnet and a hypothetical mainnet

If you ever ported this to a mainnet (don't — get an audit first), the things you would change:

| Area | Testnet | Mainnet |
|---|---|---|
| Token | Fresh `MockUSDC` | Canonical `USDC` (Circle) |
| `MockUSDC` deploy | Yes | **Skip entirely** — `Deploy.s.sol` should be edited to take an existing token address |
| Public mint function | Fine — `MockUSDC.mint(addr, amount)` | **Does not exist** — onboarding step 2 changes from "mint" to "transfer USDC in" |
| `--slow` flag | Optional | Use it; mainnet finality times matter |
| `MAX_ALLOWLIST` | 20 | Probably the same — bounded gas is bounded gas |
| Source verification | Optional, nice to have | Required for trust |
| Audit | None | **Required** before any real funds |
| Allowance pattern | Infinite approval (1M USDC) | Per-deposit `approve(amount)` |
| Agent key custody | Plaintext in `.env` | TEE / HSM / signer service |

The contract code itself does not need to change for mainnet. The deploy script and the surrounding env do.

## Adding a permanent chain entry to this repo

If the new chain is going to live alongside Anvil and Fuji as a supported demo target:

1. Update the four wiring files above.
2. Add a script under `scripts/` modelled on `deploy-fuji.sh` and `seed-fuji.sh`.
3. Add a `pnpm <chain>:deploy` and `pnpm <chain>:seed` in the root `package.json`.
4. Add a runbook under `docs/<chain>-deploy.md` modelled on [`fuji-deploy.md`](../fuji-deploy.md).
5. Update [`README.md`](../../README.md) layout block and the prize-track / verified-provenance sections.

After that, the new chain is a first-class deployment target and `pnpm contracts:test` covers the same 23 test cases against the same source.

## Reading on

- [`overview.md`](./overview.md) — the architecture you're deploying
- [`docs/fuji-deploy.md`](../fuji-deploy.md) — the existing one-command Fuji path; useful as a template
- [`docs/aws-deploy.md`](../aws-deploy.md) — putting the web side somewhere durable so the chain deploy has a frontend
- [`Deploy.s.sol`](../../contracts/script/Deploy.s.sol) and [`Seed.s.sol`](../../contracts/script/Seed.s.sol) — the scripts you'll be running
