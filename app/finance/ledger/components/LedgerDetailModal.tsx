'use client';

import { ReactNode } from 'react';

/**
 * Shared detail modal for any ledger-side row click (Master Ledger,
 * Bills, Cheques, OPEX). Mirrors the digital-access view modal so the
 * UI feels identical across pages — same modal-overlay/modal/header/
 * body/footer classes, same DetailRow K/V style.
 *
 * The host page passes a list of rows and (optionally) attachment +
 * footer actions. The modal stays read-only by design — corrections
 * happen via Reverse / Mark Paid / Mark Cleared in the action footer
 * rather than inline edit, because every ledger-side record is
 * append-only.
 */

export type DetailRowDef =
  | {
      kind?: 'row';
      label: string;
      value: ReactNode;
      tone?: 'green' | 'rose' | 'amber' | 'blue' | 'violet' | 'gray';
      multiline?: boolean;
      mono?: boolean;
    }
  | { kind: 'separator'; label?: string };

export interface BadgeDef {
  label: string;
  tone: 'green' | 'rose' | 'amber' | 'blue' | 'violet' | 'gray';
}

export interface ActionDef {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badges?: BadgeDef[];
  rows: DetailRowDef[];
  attachment?: { url: string; filename?: string } | null;
  /** Footer action buttons. The "Close" button is always rendered. */
  actions?: ActionDef[];
}

type Tone = 'green' | 'rose' | 'amber' | 'blue' | 'violet' | 'gray';

const TONE_TEXT: Record<Tone, string> = {
  green: 'text-core-greenFg',
  rose: 'text-core-roseFg',
  amber: 'text-core-amberFg',
  blue: 'text-blue-600',
  violet: 'text-violet-600',
  gray: 'text-core-text3',
};

const BADGE_CLASS: Record<BadgeDef['tone'], string> = {
  green: 'badge badge-green',
  rose: 'badge badge-red',
  amber: 'badge badge-yellow',
  blue: 'badge badge-blue',
  violet: 'badge badge-purple',
  gray: 'badge badge-gray',
};

const ACTION_CLASS: Record<NonNullable<ActionDef['variant']>, string> = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  danger: 'btn btn-sm btn-outline-danger',
};

export default function LedgerDetailModal({
  open,
  onClose,
  title,
  subtitle,
  badges,
  rows,
  attachment,
  actions,
}: Props) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal max-w-[640px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="min-w-0 flex-1">
            <h2 className="truncate">{title}</h2>
            {subtitle && (
              <div className="mt-[2px] truncate text-[11.5px] text-core-text3">
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-core-text3 transition hover:text-core-text"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {badges && badges.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {badges.map((b, i) => (
                <span key={i} className={BADGE_CLASS[b.tone]}>
                  {b.label}
                </span>
              ))}
            </div>
          )}

          {rows.map((r, i) =>
            r.kind === 'separator' ? (
              <div
                key={i}
                className="mb-1 mt-3 border-b border-core-border pb-1 text-[10px] font-bold uppercase tracking-wider text-core-text3"
              >
                {r.label ?? ''}
              </div>
            ) : (
              <DetailRow key={i} {...r} />
            ),
          )}

          {attachment?.url && (
            <div className="mt-4 rounded-xl border border-core-border bg-core-surface2 p-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-core-text3">
                Attachment
              </div>
              <AttachmentPreview url={attachment.url} filename={attachment.filename} />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
          {actions?.map((a, i) => (
            <button
              key={i}
              onClick={a.onClick}
              disabled={a.disabled}
              className={ACTION_CLASS[a.variant ?? 'primary']}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── DetailRow ──────────────────────────

function DetailRow({
  label,
  value,
  tone,
  multiline,
  mono,
}: {
  label: string;
  value: ReactNode;
  tone?: 'green' | 'rose' | 'amber' | 'blue' | 'violet' | 'gray';
  multiline?: boolean;
  mono?: boolean;
}) {
  const toneClass = tone ? TONE_TEXT[tone] : 'text-core-text';
  const isEmpty =
    value == null || (typeof value === 'string' && value.trim() === '');
  return (
    <div
      className={`flex ${
        multiline ? 'flex-col gap-1' : 'items-baseline justify-between gap-3'
      } border-b border-core-border last:border-0 py-[7px]`}
    >
      <span className="text-[12px] text-core-text3">{label}</span>
      <span
        className={`text-[12.5px] font-medium ${toneClass} ${
          mono ? 'font-mono tabular-nums' : ''
        } ${multiline ? '' : 'text-right'}`}
      >
        {isEmpty ? <span className="text-core-text3">—</span> : value}
      </span>
    </div>
  );
}

// ───────────────────────────── Attachment ─────────────────────────

function AttachmentPreview({
  url,
  filename,
}: {
  url: string;
  filename?: string;
}) {
  // Best-effort detection: attachments coming from /api/upload return
  // .jpg / .png / .pdf filenames; older /uploads/* URLs follow the same
  // shape. Fall back to a generic file link if we can't infer.
  const lower = url.toLowerCase();
  const isImage = /\.(jpe?g|png|webp|gif)$/.test(lower);
  const isPdf = /\.pdf$/.test(lower);

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded-lg border border-core-border bg-core-surface transition hover:border-core-text/30"
    >
      {isImage ? (
        <img
          src={url}
          alt={filename ?? 'Attachment'}
          className="max-h-[280px] w-full object-contain"
        />
      ) : (
        <div className="flex items-center gap-3 px-3 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-core-surface2 text-core-text2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold text-core-text">
              {filename ?? (isPdf ? 'Document.pdf' : 'Attachment')}
            </div>
            <div className="text-[11.5px] text-core-text3">
              Click to open in a new tab
            </div>
          </div>
        </div>
      )}
    </a>
  );
}
