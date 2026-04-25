/// USDC has 6 decimals.
export const USDC_DECIMALS = 6;

export function formatUsdc(value: bigint | undefined): string {
  if (value === undefined) return "—";
  const whole = value / 10n ** BigInt(USDC_DECIMALS);
  const frac = value % 10n ** BigInt(USDC_DECIMALS);
  const fracStr = frac.toString().padStart(USDC_DECIMALS, "0").slice(0, 2);
  return `${whole}.${fracStr}`;
}

export function parseUsdc(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{0,6})?$/.test(trimmed)) {
    throw new Error(`Invalid USDC amount: ${input}`);
  }
  const parts = trimmed.split(".");
  const whole = parts[0] ?? "0";
  const frac = parts[1] ?? "";
  const padded = (frac + "000000").slice(0, 6);
  return BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt(padded);
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
