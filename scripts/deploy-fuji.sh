#!/usr/bin/env bash
# One-command Fuji deploy.
#
# Required env:
#   DEPLOYER_PRIVATE_KEY   Fuji-funded EOA. Get free testnet AVAX from
#                          https://core.app/tools/testnet-faucet/?subnet=c&token=c
#
# Optional env:
#   FUJI_RPC_URL           defaults to the public Avalanche Fuji RPC.
#
# What it does:
#   1. forge script Deploy.s.sol --broadcast against Fuji
#   2. parses MockUSDC + PolicyVault addresses from the broadcast artifact
#   3. rewrites packages/contracts/src/addresses.ts for chain 43113
#   4. prints the explorer URLs and the next-step command list
#
# Run from the repo root: bash scripts/deploy-fuji.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "${DEPLOYER_PRIVATE_KEY:-}" ]]; then
  echo "DEPLOYER_PRIVATE_KEY is not set." >&2
  echo "Export a Fuji-funded private key, e.g.:" >&2
  echo "  export DEPLOYER_PRIVATE_KEY=0x..." >&2
  exit 2
fi

FUJI_RPC_URL="${FUJI_RPC_URL:-https://api.avax-test.network/ext/bc/C/rpc}"

echo "Deploying to Fuji (chain 43113) at $FUJI_RPC_URL"
forge script "$ROOT/packages/contracts/script/Deploy.s.sol" \
  --root "$ROOT/packages/contracts" \
  --rpc-url "$FUJI_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  --slow

BROADCAST="$ROOT/packages/contracts/broadcast/Deploy.s.sol/43113/run-latest.json"
if [[ ! -f "$BROADCAST" ]]; then
  echo "expected broadcast artifact at $BROADCAST" >&2
  exit 1
fi

USDC=$(jq -r '.transactions[] | select(.contractName=="MockUSDC") | .contractAddress' "$BROADCAST")
VAULT=$(jq -r '.transactions[] | select(.contractName=="PolicyVault") | .contractAddress' "$BROADCAST")

if [[ -z "$USDC" || "$USDC" == "null" || -z "$VAULT" || "$VAULT" == "null" ]]; then
  echo "could not parse contract addresses from $BROADCAST" >&2
  exit 1
fi

echo ""
echo "Deployed:"
echo "  MockUSDC:    $USDC  https://testnet.snowtrace.io/address/$USDC"
echo "  PolicyVault: $VAULT  https://testnet.snowtrace.io/address/$VAULT"
echo ""

node "$ROOT/scripts/update-fuji-addresses.mjs" "$USDC" "$VAULT"

echo ""
echo "Next steps:"
echo "  1. Connect MetaMask to Fuji and switch to your demo USER address."
echo "  2. Open the web UI (\`pnpm -F @safespend/merchant dev\`) and walk the"
echo "     onboarding: set policy, mint MockUSDC, approve vault, deposit."
echo "  3. Run scripts/seed-fuji.sh to top up the vulnerable session wallet."
echo "  4. Click 'Run' on each panel and capture both explorer links."
