import React from 'react';

/**
 * Shared "Audit Trail" card for any record-detail page (expenses,
 * offer letters, etc).
 *
 * Replaces the previous `JSON.stringify(...).substring(0, 100) + '...'`
 * blob with a real table:
 *
 *   When        | Who        | Action      | Changes
 *   2 May 2026  | Aqib (HR)  | CREATE      | Initial values
 *   3 May 2026  | Admin      | UPDATE      | status: PENDING → APPROVED
 *
 * The "Changes" column parses oldValues / newValues:
 *   - CREATE   → list of {field, value} pairs from newValues
 *   - UPDATE   → diff lines "field: old → new" for keys that changed
 *   - DELETE   → list from oldValues with a strikethrough label
 *
 * Always wraps the table in `overflow-x-auto` so narrow screens
 * (phones / split panels) get a horizontal scroller instead of a
 * cramped layout that breaks the rest of the page.
 */

interface AuditLog {
  id: number;
  action: string;
  oldValues: any;
  newValues: any;
  createdAt: Date | string;
  changedBy: {
    email: string;
    employee?: { firstName: string; lastName: string } | null;
  } | null;
}

const ACTION_TONE: Record<string, string> = {
  CREATE: 'badge-green',
  UPDATE: 'badge-blue',
  DELETE: 'badge-red',
  APPROVE: 'badge-green',
  REJECT: 'badge-red',
};

// Keys we hide from the diff because they don't add signal — they
// change on every save and clutter the view.
const NOISE_KEYS = new Set([
  'updatedAt',
  'createdAt',
  'id',
]);

function displayValue(v: any): string {
  if (v == null) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toLocaleString();
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function diffEntries(
  oldValues: any,
  newValues: any,
): { key: string; old?: any; new?: any; kind: 'added' | 'changed' | 'removed' | 'unchanged' }[] {
  if (!newValues && !oldValues) return [];
  const o = oldValues ?? {};
  const n = newValues ?? {};
  const keys = new Set<string>([...Object.keys(o), ...Object.keys(n)]);
  const out: any[] = [];
  for (const k of keys) {
    if (NOISE_KEYS.has(k)) continue;
    const a = o[k];
    const b = n[k];
    const sameStrings = JSON.stringify(a) === JSON.stringify(b);
    if (sameStrings) continue;
    if (a === undefined && b !== undefined) {
      out.push({ key: k, new: b, kind: 'added' });
    } else if (a !== undefined && b === undefined) {
      out.push({ key: k, old: a, kind: 'removed' });
    } else {
      out.push({ key: k, old: a, new: b, kind: 'changed' });
    }
  }
  return out;
}

function whoLabel(by: AuditLog['changedBy']): string {
  if (!by) return 'System';
  if (by.employee?.firstName) {
    return `${by.employee.firstName} ${by.employee.lastName}`;
  }
  return by.email;
}

export default function AuditTrailCard({ logs }: { logs: AuditLog[] }) {
  if (!logs || logs.length === 0) return null;

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="section-heading">Audit Trail</h2>
        <p className="text-[11.5px] text-core-text3 mt-1">
          {logs.length} {logs.length === 1 ? 'event' : 'events'} on this
          record.
        </p>
      </div>
      <div className="card-body p-0">
        <div className="overflow-x-auto">
          <table
            className="w-full text-[12.5px]"
            style={{ borderCollapse: 'collapse' }}
          >
            <thead>
              <tr className="bg-core-surface2">
                {['When', 'Who', 'Action', 'Changes'].map((h) => (
                  <th
                    key={h}
                    className="border-b border-core-border px-[12px] py-[10px] text-left text-[10px] font-bold uppercase text-core-text3 whitespace-nowrap"
                    style={{ letterSpacing: '0.08em' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => {
                const isLast = idx === logs.length - 1;
                const diff = diffEntries(log.oldValues, log.newValues);
                const tone = ACTION_TONE[log.action] || 'badge-gray';
                return (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: isLast ? 'none' : '1px solid #E5E8DD',
                    }}
                    className="align-top"
                  >
                    <td className="whitespace-nowrap px-[12px] py-[10px] tabular-nums text-core-text2">
                      <div>
                        {new Date(log.createdAt).toLocaleDateString()}
                      </div>
                      <div className="mt-[1px] text-[10.5px] text-core-text3">
                        {new Date(log.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="px-[12px] py-[10px] text-core-text2 max-w-[180px] break-words">
                      {whoLabel(log.changedBy)}
                    </td>
                    <td className="px-[12px] py-[10px] whitespace-nowrap">
                      <span className={`badge ${tone}`}>{log.action}</span>
                    </td>
                    <td className="px-[12px] py-[10px] text-[12px]">
                      {diff.length === 0 ? (
                        <span className="text-core-text3">No field changes</span>
                      ) : (
                        <ul className="space-y-[3px]">
                          {diff.map((d) => (
                            <li key={d.key} className="leading-snug">
                              <span className="font-mono text-[11px] text-core-text3">
                                {d.key}
                              </span>{' '}
                              {d.kind === 'changed' && (
                                <>
                                  <span className="text-core-roseFg line-through">
                                    {displayValue(d.old)}
                                  </span>
                                  <span className="text-core-text3"> → </span>
                                  <span className="font-medium text-core-greenFg">
                                    {displayValue(d.new)}
                                  </span>
                                </>
                              )}
                              {d.kind === 'added' && (
                                <span className="font-medium text-core-greenFg">
                                  {displayValue(d.new)}
                                </span>
                              )}
                              {d.kind === 'removed' && (
                                <span className="text-core-roseFg line-through">
                                  {displayValue(d.old)}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
