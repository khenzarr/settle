import { USDC_DECIMALS } from "./constants.ts";

const USDC_AMOUNT_PATTERN = /^(\d+)(?:\.(\d+))?$/;
const USDC_SCALE = 10n ** BigInt(USDC_DECIMALS);

function assertNonNegative(value: bigint): void {
  if (value < 0n) throw new RangeError("USDC amount cannot be negative");
}

export function parseUsdcAmount(value: string, options: { allowZero?: boolean } = {}): bigint {
  if (value.length === 0 || value.trim() !== value) {
    throw new Error("USDC amount must be non-empty and contain no surrounding whitespace");
  }
  const match = USDC_AMOUNT_PATTERN.exec(value);
  if (!match) throw new Error("Invalid USDC amount");
  const fraction = match[2] ?? "";
  if (fraction.length > USDC_DECIMALS) throw new Error("USDC amount has more than six decimal places");
  const amount = BigInt(match[1]) * USDC_SCALE + BigInt(fraction.padEnd(USDC_DECIMALS, "0") || "0");
  if (!options.allowZero && amount === 0n) throw new Error("USDC amount must be positive");
  return amount;
}

export function parseUsdcAmountAllowZero(value: string): bigint {
  return parseUsdcAmount(value, { allowZero: true });
}

export function formatUsdcAmount(value: bigint): string {
  assertNonNegative(value);
  const whole = value / USDC_SCALE;
  const fraction = (value % USDC_SCALE).toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/** Formats by deterministically truncating base-unit digits beyond fractionDigits. */
export function formatUsdcAmountFixed(value: bigint, fractionDigits: number = USDC_DECIMALS): string {
  assertNonNegative(value);
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > USDC_DECIMALS) {
    throw new RangeError(`fractionDigits must be an integer from 0 to ${USDC_DECIMALS}`);
  }
  const displayedScale = 10n ** BigInt(fractionDigits);
  const truncated = value / (10n ** BigInt(USDC_DECIMALS - fractionDigits));
  const whole = truncated / displayedScale;
  if (fractionDigits === 0) return whole.toString();
  return `${whole}.${(truncated % displayedScale).toString().padStart(fractionDigits, "0")}`;
}