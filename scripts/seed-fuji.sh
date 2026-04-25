#!/usr/bin/env bash
# Top up the vulnerable session wallet on Fuji.
#
# The safe-mode user funds themselves through the web UI's onboarding
# (setPolicy -> mint -> approve -> deposit), so this script funds the
# vulnerable agent: mints MockUSDC AND sends a small amount of AVAX
# for gas (the agent EOA needs gas to broadcast txns).
#
# Required env:
#   DEPLOYER_PRIVATE_KEY        deployer key (the same one used by deploy-fuji.sh)
#   AUTHORIZED_AGENT_ADDRESS    agent EOA to fund
#
# Optional env:
#   FUJI_RPC_URL                defaults to the public Fuji RPC.
#   AGENT_BUDGET                MockUSDC base units; defaults to 500 USDC.
#   AGENT_AVAX                  AVAX amount (with unit) to send for gas; defaults to 0.5ether.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

: "${DEPLOYER_PRIVATE_KEY:?DEPLOYER_PRIVATE_KEY must be set}"
: "${AUTHORIZED_AGENT_ADDRESS:?AUTHORIZED_AGENT_ADDRESS must be set}"

FUJI_RPC_URL="${FUJI_RPC_URL:-https://api.avax-test.network/ext/bc/C/rpc}"
AGENT_BUDGET="${AGENT_BUDGET:-500000000}"  # 500 USDC, 6 decimals
AGENT_AVAX="${AGENT_AVAX:-0.3ether}"  # leaves headroom in deployer; faucet only drops 2 AVAX

# Pull the deployed USDC address from shared/src/addresses.ts so we don't
# have to re-pass it.
USDC=$(node -e "
  const src = require('fs').readFileSync('$ROOT/shared/src/addresses.ts', 'utf8');
  const m = src.match(/43113:\s*\{[^}]*usdc:\s*\"(0x[0-9a-fA-F]{40})\"/);
  if (!m) { console.error('No 43113 USDC address; run deploy-fuji.sh first.'); process.exit(1); }
  console.log(m[1]);
")

echo "Minting $AGENT_BUDGET base units of MockUSDC ($USDC) to vulnerable agent $AUTHORIZED_AGENT_ADDRESS"

cast send "$USDC" \
  "mint(address,uint256)" "$AUTHORIZED_AGENT_ADDRESS" "$AGENT_BUDGET" \
  --rpc-url "$FUJI_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY"

echo ""
echo "Sending $AGENT_AVAX AVAX (gas) to $AUTHORIZED_AGENT_ADDRESS"

cast send "$AUTHORIZED_AGENT_ADDRESS" \
  --value "$AGENT_AVAX" \
  --rpc-url "$FUJI_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY"

echo ""
echo "Agent USDC balance:"
cast call "$USDC" "balanceOf(address)(uint256)" "$AUTHORIZED_AGENT_ADDRESS" \
  --rpc-url "$FUJI_RPC_URL"

echo "Agent AVAX balance:"
cast balance "$AUTHORIZED_AGENT_ADDRESS" --rpc-url "$FUJI_RPC_URL"
