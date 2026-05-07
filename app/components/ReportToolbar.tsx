'use client';

import React from 'react';

/**
 * Filter strip used by every module table that supports period-scoped
 * exports — Bills, Cheques, OPEX, Expenses, and the Master Ledger.
 *
 * Renders: [From] [To] [Reset] ………… [CSV] [PDF] [right-slot]
 *
 * The right-slot is a children prop so each tab can drop its existing
 * action button (New Bill, New Cheque, etc.) on the same row without
 * fighting layout.
 */

interface Props {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (next: string) => void;
  onDateToChange: (next: string) => void;
  onReset?: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  /** Disabled state while parent is loading rows. */
  busy?: boolean;
  /** Optional "New X" action button rendered at the far right. */
  children?: React.ReactNode;
}

export default function ReportToolbar({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onReset,
  onExportCsv,
  onExportPdf,
  busy,
  children,
}: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-core-text3">
        Period
      </label>
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => onDateFromChange(e.target.value)}
        className="h-9 rounded-lg border border-core-border bg-core-surface px-2 text-[12.5px] text-core-text2"
        aria-label="From"
      />
      <span className="text-core-text3">→</span>
      <input
        type="date"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        className="h-9 rounded-lg border border-core-border bg-core-surface px-2 text-[12.5px] text-core-text2"
        aria-label="To"
      />
      {onReset && (dateFrom || dateTo) && (
        <button
          type="button"
          onClick={onReset}
          className="text-[12px] font-medium text-core-text3 hover:text-core-text"
        >
          Clear
        </button>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onExportCsv}
          disabled={busy}
          className="btn btn-sm btn-secondary disabled:opacity-50"
          title="Download a CSV of the rows in the selected period"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3" />
          </svg>
          CSV
        </button>
        <button
          type="button"
          onClick={onExportPdf}
          disabled={busy}
          className="btn btn-sm btn-secondary disabled:opacity-50"
          title="Open the printable view — pick Save as PDF in the print dialog"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M9 14h6 M9 18h6" />
          </svg>
          PDF
        </button>
        {children}
      </div>
    </div>
  );
}
