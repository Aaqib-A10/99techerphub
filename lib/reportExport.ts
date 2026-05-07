/**
 * Shared report-export helpers for module tables (Bills, Cheques,
 * OPEX, Expenses, Ledger). Two output formats:
 *
 *   downloadCsv(...)      — triggers a browser download of a .csv
 *   openPrintReport(...)  — opens a new tab with a printable HTML
 *                           page that auto-fires window.print() so
 *                           the user just picks "Save as PDF"
 *
 * Both formats share the same `ColumnDef[]` so a tab defines its
 * columns once and gets both outputs for free. Keeps the CSV header,
 * PDF header, and print layout perfectly in sync — change the column
 * label in one place and both downstreams update.
 */

export interface ColumnDef<T> {
  /** Header label shown in the CSV first row and PDF table head. */
  header: string;
  /** Pulls the raw value out of a row. Numbers / strings only — */
  /** anything else is stringified before output. */
  value: (row: T) => string | number | null | undefined;
  /** Right-align numeric / amount columns. Default left. */
  align?: 'left' | 'right';
}

export interface PrintReportOptions<T> {
  /** Big title on the printed page, e.g. "Bills Register". */
  title: string;
  /** Optional subtitle under the title. Use for company / scope. */
  subtitle?: string;
  /** Period block — usually "1 May 2026 → 31 May 2026". Empty if all-time. */
  period?: string;
  rows: T[];
  columns: ColumnDef<T>[];
  /** Optional totals row(s) shown below the table. */
  totals?: { label: string; value: string }[];
}

// ───────────────────────────── CSV ─────────────────────────────

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv<T>(rows: T[], columns: ColumnDef<T>[]): string {
  const header = columns.map((c) => csvEscape(c.header)).join(',');
  const body = rows
    .map((r) => columns.map((c) => csvEscape(c.value(r))).join(','))
    .join('\n');
  return rows.length === 0 ? header + '\n' : header + '\n' + body + '\n';
}

export function downloadCsv<T>(
  filename: string,
  rows: T[],
  columns: ColumnDef<T>[],
): void {
  const csv = buildCsv(rows, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ───────────────────────────── PDF (browser print) ─────────────────

function htmlEscape(s: unknown): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPrintHtml<T>(opts: PrintReportOptions<T>): string {
  const { title, subtitle, period, rows, columns, totals } = opts;
  const generated = new Date().toLocaleString();

  const thead = columns
    .map(
      (c) =>
        `<th style="text-align:${c.align ?? 'left'}">${htmlEscape(c.header)}</th>`,
    )
    .join('');

  const tbody = rows
    .map(
      (r) =>
        `<tr>${columns
          .map(
            (c) =>
              `<td style="text-align:${c.align ?? 'left'}">${htmlEscape(c.value(r))}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');

  const totalsBlock = totals?.length
    ? `<div class="totals">${totals
        .map(
          (t) =>
            `<div class="total-row"><span class="total-label">${htmlEscape(t.label)}</span><span class="total-value">${htmlEscape(t.value)}</span></div>`,
        )
        .join('')}</div>`
    : '';

  // Self-contained HTML — no external assets, no JS deps. autoprint on
  // load triggers Save-as-PDF in the browser dialog. @media print
  // strips the page chrome so what you save matches what's on screen.
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${htmlEscape(title)}${period ? ' — ' + htmlEscape(period) : ''}</title>
  <style>
    @page { size: A4 landscape; margin: 14mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1F2320;
      font-size: 11px;
      margin: 24px;
      background: #fff;
    }
    .hdr { border-bottom: 2px solid #1F2320; padding-bottom: 10px; margin-bottom: 14px; }
    h1 { margin: 0 0 4px 0; font-size: 20px; letter-spacing: -0.01em; }
    .sub { color: #5A6159; font-size: 12px; }
    .meta {
      display: flex; gap: 18px; margin-top: 6px;
      font-size: 10.5px; color: #5A6159;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th {
      background: #F1F3EB; color: #5A6159;
      text-transform: uppercase; letter-spacing: 0.06em;
      font-size: 9px; font-weight: 700;
      padding: 8px 10px; border-bottom: 1px solid #C9CFC0;
    }
    td {
      padding: 6px 10px; border-bottom: 1px solid #E5E8DD;
      vertical-align: top; font-size: 11px;
    }
    tr:nth-child(even) td { background: #FAFBF7; }
    .totals { margin-top: 16px; border-top: 2px solid #1F2320; padding-top: 8px; }
    .total-row {
      display: flex; justify-content: space-between;
      font-size: 12px; margin: 4px 0;
    }
    .total-label { color: #5A6159; }
    .total-value { font-weight: 600; font-variant-numeric: tabular-nums; }
    .empty {
      text-align: center; padding: 40px 0;
      color: #8B918A; font-style: italic;
    }
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body onload="setTimeout(function(){ window.print(); }, 200);">
  <div class="hdr">
    <h1>${htmlEscape(title)}</h1>
    ${subtitle ? `<div class="sub">${htmlEscape(subtitle)}</div>` : ''}
    <div class="meta">
      ${period ? `<div><strong>Period:</strong> ${htmlEscape(period)}</div>` : ''}
      <div><strong>Generated:</strong> ${htmlEscape(generated)}</div>
      <div><strong>Records:</strong> ${rows.length}</div>
    </div>
  </div>
  ${
    rows.length === 0
      ? `<div class="empty">No records in this period.</div>`
      : `<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`
  }
  ${totalsBlock}
</body>
</html>`;
}

export function openPrintReport<T>(opts: PrintReportOptions<T>): void {
  const html = buildPrintHtml(opts);
  const win = window.open('', '_blank');
  if (!win) {
    alert(
      'Pop-up blocked. Allow pop-ups for this site and click PDF again.',
    );
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ───────────────────────────── Date helpers ────────────────────────

/**
 * Returns ISO yyyy-mm-dd strings for the first and last day of the
 * current month — used as the default From/To values on first load.
 */
export function thisMonthRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: fmt(start), to: fmt(end) };
}

/**
 * "1 May 2026 → 31 May 2026", or empty string if no range set. Used
 * in the PDF header.
 */
export function formatPeriod(from: string, to: string): string {
  if (!from && !to) return '';
  const f = (s: string) =>
    s
      ? new Date(s).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '';
  if (from && to) return `${f(from)} → ${f(to)}`;
  return from ? `from ${f(from)}` : `up to ${f(to)}`;
}

/**
 * Inclusive date-range filter for client-side row filtering. `to` is
 * extended to end-of-day so 2026-05-31 includes events on that day.
 */
export function inDateRange(
  isoOrDate: string | Date,
  from: string,
  to: string,
): boolean {
  const t = new Date(isoOrDate).getTime();
  if (from) {
    if (t < new Date(from).getTime()) return false;
  }
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (t > end.getTime()) return false;
  }
  return true;
}
