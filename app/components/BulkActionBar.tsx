'use client';

import React from 'react';

export interface BulkAction {
  key: string;
  label: string;
  /** Optional override for the auto-mapped icon. */
  icon?: React.ReactNode;
  variant?: 'default' | 'danger' | 'success' | 'warning';
  /** If set, show window.confirm before executing. {count} is replaced. */
  confirm?: string;
}

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  allSelected: boolean;
  actions: BulkAction[];
  onAction: (actionKey: string) => void;
  loading?: string | null;
}

/* ---------- inline icons (no external dep) ---------- */

const ICON_PROPS = {
  width: 13,
  height: 13,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const ICONS: Record<string, React.ReactNode> = {
  export: (
    <svg {...ICON_PROPS}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3" />
    </svg>
  ),
  delete: (
    <svg {...ICON_PROPS}>
      <path d="M3 6h18 M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2 M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6 M10 11v6 M14 11v6" />
    </svg>
  ),
  activate: (
    <svg {...ICON_PROPS}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  ),
  deactivate: (
    <svg {...ICON_PROPS}>
      <path d="M18.36 6.64a9 9 0 11-12.73 0 M12 2v10" />
    </svg>
  ),
  archive: (
    <svg {...ICON_PROPS}>
      <path d="M21 8v13H3V8 M1 3h22v5H1z M10 12h4" />
    </svg>
  ),
  approve: (
    <svg {...ICON_PROPS}>
      <path d="M9 12l2 2 4-4 M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  reject: (
    <svg {...ICON_PROPS}>
      <path d="M15 9l-6 6 M9 9l6 6 M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  unassign: (
    <svg {...ICON_PROPS}>
      <path d="M19 12H5 M12 5l-7 7 7 7" />
    </svg>
  ),
  revoke: (
    <svg {...ICON_PROPS}>
      <path d="M18 6L6 18 M6 6l12 12" />
    </svg>
  ),
};

/* ---------- variant styling ---------- */

const VARIANT_CLASSES: Record<NonNullable<BulkAction['variant']>, string> = {
  default:
    'bg-core-surface text-core-text2 ring-core-border/85 hover:bg-core-surface2 hover:ring-core-border',
  success:
    'bg-core-greenSoft text-core-greenFg ring-core-greenFg hover:bg-core-green',
  warning: 'bg-core-amberSoft text-core-amberFg ring-amber-200 hover:bg-core-amberSoft',
  danger: 'bg-core-roseSoft text-core-roseFg ring-rose-200 hover:bg-core-roseSoft',
};

/* ---------- spinner ---------- */

const Spinner = () => (
  <svg
    className="animate-spin"
    width={13}
    height={13}
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="3"
      style={{ opacity: 0.25 }}
    />
    <path
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      style={{ opacity: 0.85 }}
    />
  </svg>
);

/* ---------- component ---------- */

export default function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  allSelected,
  actions,
  onAction,
  loading,
}: BulkActionBarProps) {
  // Single-row actions live inline on each row (Delete, Revoke, View
  // Details, etc) — the bar is reserved for genuine BULK work to avoid
  // duplicating affordances. Hidden until 2+ rows are selected.
  if (selectedCount < 2) return null;

  const handleAction = (action: BulkAction) => {
    if (action.confirm) {
      const message = action.confirm.replace('{count}', String(selectedCount));
      if (!window.confirm(message)) return;
    }
    onAction(action.key);
  };

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="fixed bottom-6 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 flex-wrap items-center gap-3 rounded-xl bg-core-surface px-4 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.08)] ring-1 ring-core-border/85"
    >
      {/* selection count */}
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-core-green px-2 text-[12px] font-semibold text-white tabular-nums">
          {selectedCount}
        </span>
        <span className="text-[13px] text-core-text2">selected</span>
      </div>

      {/* select all / clear */}
      <div className="flex items-center gap-2 text-[12px]">
        {!allSelected && (
          <button
            type="button"
            onClick={onSelectAll}
            className="font-medium text-core-greenFg hover:text-core-greenFg"
          >
            Select all {totalCount}
          </button>
        )}
        <button
          type="button"
          onClick={onDeselectAll}
          className="text-core-text3 hover:text-core-text2"
        >
          Clear
        </button>
      </div>

      <div className="h-6 w-px bg-core-border" />

      {/* actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        {actions.map((action) => {
          const variant = action.variant ?? 'default';
          const isLoading = loading === action.key;
          const icon = action.icon ?? ICONS[action.key];
          return (
            <button
              key={action.key}
              type="button"
              onClick={() => handleAction(action)}
              disabled={!!loading}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium ring-1 transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]}`}
            >
              {isLoading ? <Spinner /> : icon ?? null}
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
