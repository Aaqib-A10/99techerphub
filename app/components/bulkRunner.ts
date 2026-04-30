/**
 * Helper for running a bulk operation across many ids and surfacing
 * partial-success state to the caller. Replaces the silent-fail pattern
 *   for (const id of ids) await fetch(...);
 * which masked 4xx/5xx responses and missing endpoints.
 */
export interface BulkRunResult<T> {
  succeededIds: Set<T>;
  failures: { id: T; reason: string }[];
}

export async function runBulk<T>(opts: {
  ids: T[];
  request: (id: T) => Promise<Response>;
}): Promise<BulkRunResult<T>> {
  const succeededIds = new Set<T>();
  const failures: { id: T; reason: string }[] = [];

  for (const id of opts.ids) {
    let res: Response;
    try {
      res = await opts.request(id);
    } catch (e: any) {
      failures.push({ id, reason: e?.message ?? 'Network error' });
      continue;
    }
    if (res.ok) {
      succeededIds.add(id);
    } else {
      const reason = await res
        .json()
        .then((j) => j.error || `HTTP ${res.status}`)
        .catch(() => `HTTP ${res.status}`);
      failures.push({ id, reason });
    }
  }

  return { succeededIds, failures };
}

/**
 * Compose a user-facing message after a bulk run. Caller alerts/toasts it.
 * Returns null when nothing went wrong (caller should skip the alert).
 */
export function summarizeBulk<T>(
  result: BulkRunResult<T>,
  totalAttempted: number,
  verb: string,
): string | null {
  if (result.failures.length === 0) return null;
  const head = `${verb}d ${result.succeededIds.size} of ${totalAttempted}. ${result.failures.length} failed:`;
  const lines = result.failures
    .slice(0, 8)
    .map((f) => `• #${String(f.id)}: ${f.reason}`);
  const tail =
    result.failures.length > 8
      ? `\n… and ${result.failures.length - 8} more`
      : '';
  return `${head}\n\n${lines.join('\n')}${tail}`;
}
