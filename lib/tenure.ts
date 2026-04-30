/**
 * One-stop tenure formatting. Bug fix #5: previously the employee detail
 * card showed "2y 3m" while other surfaces invented their own format —
 * inconsistent across tables. This is the single source of truth.
 *
 * Strategy:
 *   < 30 days   → "12 Days" (or "1 Day")
 *   < 12 months → "5 Months" (or "1 Month")
 *   ≥ 12 months → "2y 3m" (compact — survives in tight table cells)
 */
export function formatTenureMonthsFirst(days: number): string {
  if (!Number.isFinite(days) || days < 0) return '0 Days';
  if (days < 30) {
    return days === 1 ? '1 Day' : `${days} Days`;
  }
  const totalMonths = Math.floor(days / 30);
  if (totalMonths < 12) {
    return totalMonths === 1 ? '1 Month' : `${totalMonths} Months`;
  }
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return months > 0 ? `${years}y ${months}m` : `${years}y`;
}

/**
 * Convenience: compute tenure days between two dates and format.
 * `endDate` defaults to "now" — pass dateOfLeaving for exited employees.
 */
export function tenureLabel(joinDate: Date, endDate: Date = new Date()): string {
  const ms = endDate.getTime() - joinDate.getTime();
  const days = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  return formatTenureMonthsFirst(days);
}
