#!/usr/bin/env node
/// Rewrite the chain-43113 entry in packages/contracts/src/addresses.ts.
///
/// Usage:
///   node scripts/update-fuji-addresses.mjs <usdc> <vault>

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [, , usdc, vault] = process.argv;
if (!usdc || !vault) {
  console.error("usage: update-fuji-addresses.mjs <usdc> <vault>");
  process.exit(2);
}

const ADDR = /^0x[0-9a-fA-F]{40}$/;
if (!ADDR.test(usdc) || !ADDR.test(vault)) {
  console.error("both arguments must be 0x-prefixed 40-hex-char addresses");
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const path = join(here, "..", "packages", "contracts", "src", "addresses.ts");

const src = readFileSync(path, "utf8");
const pattern = /(43113:\s*\{)[\s\S]*?\}/;
const replacement = `$1\n    usdc: "${usdc}",\n    vault: "${vault}",\n  }`;
const next = src.replace(pattern, replacement);

if (next === src) {
  console.error(`could not find a 43113 entry to update in ${path}`);
  process.exit(1);
}

writeFileSync(path, next);
console.log(`updated ${path}`);
console.log(`  usdc:  ${usdc}`);
console.log(`  vault: ${vault}`);
