/**
 * Safe decimal arithmetic for financial calculations.
 * Converts Prisma Decimal / number / string values to integers (paisa/cents),
 * performs arithmetic, and converts back to avoid IEEE 754 rounding errors.
 *
 * All amounts are internally represented as integers in the smallest currency
 * unit (e.g., paisa for PKR, cents for USD). The scale factor is 100.
 */

const SCALE = 100;

/** Convert a value (Decimal, number, string, null) to an integer in minor units */
export function toMinor(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * SCALE);
}

/** Convert minor units back to a display number (2 decimal places) */
export function toMajor(minor: number): number {
  return minor / SCALE;
}

/** Sum an array of values safely */
export function safeSum(values: unknown[]): number {
  const totalMinor = values.reduce<number>((acc, v) => acc + toMinor(v), 0);
  return toMajor(totalMinor);
}

/** Subtract b from a safely */
export function safeSub(a: unknown, b: unknown): number {
  return toMajor(toMinor(a) - toMinor(b));
}

/** Add a and b safely */
export function safeAdd(a: unknown, b: unknown): number {
  return toMajor(toMinor(a) + toMinor(b));
}
