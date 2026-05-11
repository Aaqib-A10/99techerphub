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

// ---------------------------------------------------------------------------
// USD ↔ PKR conversion for dashboard summaries
// ---------------------------------------------------------------------------
//
// We do NOT convert when storing or in registers (Compensation,
// per-employee tabs, etc) — that would lie about what people earn or
// were billed. We DO convert on the dashboard burn / KPI tiles where
// the user wants a single at-a-glance number across both currencies.
//
// Rate source priority:
//   1. process.env.USD_TO_PKR_RATE  (set this on prod when the rate
//      drifts; PM2 restart picks it up).
//   2. Hardcoded fallback (279 PKR/USD — the locked contract rate
//      Deel uses for 99tech payouts. Update this constant if Deel
//      renegotiates; bumping the env var on prod also works for a
//      mid-cycle override).
//
// Refresh policy: manual. We don't pull from a live FX feed because
// (a) the dashboard doesn't need 4-decimal precision, (b) live feeds
// add a dependency, (c) accountants want a stable rate that matches
// the contractual one used by the payment provider.

const USD_TO_PKR_FALLBACK = 279;

export function getUsdToPkrRate(): number {
  const fromEnv = parseFloat(process.env.USD_TO_PKR_RATE || '');
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return USD_TO_PKR_FALLBACK;
}

/**
 * Convert a value in `currency` into PKR using the current rate. PKR
 * passes through unchanged. Anything else than 'USD' / 'PKR' returns
 * 0 — we don't silently misconvert unknown currencies.
 */
export function toPkr(amount: unknown, currency: string | null | undefined): number {
  const major = parseCurrency(amount);
  if (!currency || currency === 'PKR') return major;
  if (currency === 'USD') return parseCurrency(major * getUsdToPkrRate());
  return 0;
}
