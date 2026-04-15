/**
 * Safe decimal arithmetic for financial calculations.
 *
 * After the Float → Decimal migration, Prisma returns `Prisma.Decimal` objects.
 * This module normalises ANY input (Decimal, number, string, null) into
 * integer minor units (paisa / cents), performs arithmetic there, and
 * converts back.  Using integer arithmetic eliminates IEEE 754 drift.
 *
 * RULE: Every monetary value entering the system (from JSON body, query param,
 *       or form field) MUST pass through `parseCurrency()` before storage.
 *       Never use raw `parseFloat()` on financial data.
 */

const SCALE = 100; // 2 decimal places

// ---------------------------------------------------------------------------
// Core converters
// ---------------------------------------------------------------------------

/** Convert any value to an integer in minor units (paisa/cents). */
export function toMinor(value: unknown): number {
  if (value === null || value === undefined) return 0;
  // Prisma Decimal has a .toNumber() but also toString(); Number() handles both
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * SCALE);
}

/** Convert minor units back to a major-unit number (2 dp). */
export function toMajor(minor: number): number {
  return minor / SCALE;
}

// ---------------------------------------------------------------------------
// Input parsing — replaces parseFloat() everywhere
// ---------------------------------------------------------------------------

/**
 * Parse user / API input into a safe storage value.
 * Rounds to exactly 2 decimal places via integer round-trip.
 *
 * @example
 *   parseCurrency('83333.335')  // → 83333.34
 *   parseCurrency(null)         // → 0
 */
export function parseCurrency(input: unknown): number {
  return toMajor(toMinor(input));
}

// ---------------------------------------------------------------------------
// Arithmetic helpers
// ---------------------------------------------------------------------------

/** Sum an array of monetary values safely. */
export function safeSum(values: unknown[]): number {
  const totalMinor = values.reduce<number>((acc, v) => acc + toMinor(v), 0);
  return toMajor(totalMinor);
}

/** a − b, safe. */
export function safeSub(a: unknown, b: unknown): number {
  return toMajor(toMinor(a) - toMinor(b));
}

/** a + b, safe. */
export function safeAdd(a: unknown, b: unknown): number {
  return toMajor(toMinor(a) + toMinor(b));
}

// ---------------------------------------------------------------------------
// Percentage helpers
// ---------------------------------------------------------------------------

/**
 * (value × pct) / 100, rounded to 2 dp.
 * Both value and pct can be Decimal / number / string.
 */
export function applyPercentage(value: unknown, percentage: unknown): number {
  const v = toMinor(value);          // value in paisa
  const p = toMinor(percentage);     // pct × 100  (e.g. 33.33 → 3333)
  return toMajor(Math.round((v * p) / (100 * SCALE)));
}

/**
 * Validate that an array of percentage values sums to exactly 100.00%.
 * Uses integer arithmetic — no floating-point tolerance needed.
 */
export function validatePercentageSum(percentages: unknown[]): boolean {
  const totalMinor = percentages.reduce<number>((acc, v) => acc + toMinor(v), 0);
  return totalMinor === 100 * SCALE; // 10 000
}
