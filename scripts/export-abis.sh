#!/usr/bin/env bash
# Extract ABI arrays from forge build output into packages/contracts/abis/.
# Run after `forge build --root packages/contracts`.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/packages/contracts/out"
DEST="$ROOT/packages/contracts/abis"

mkdir -p "$DEST"

for name in MockUSDC PolicyVault; do
  src="$OUT/${name}.sol/${name}.json"
  if [[ ! -f "$src" ]]; then
    echo "missing artifact: $src (run \`forge build --root contracts\` first)" >&2
    exit 1
  fi
  jq '.abi' "$src" > "$DEST/${name}.json"
  echo "exported $DEST/${name}.json"
done
