'use client';

import { useState } from 'react';

export interface BulkAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'danger' | 'success' | 'warning';
  /** If true, show a confirm dialog before executing */
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
  loading?: string | null; // key of action currently loading
}

const variantStyles: Record<string, React.CSSProperties> = {
  default: {
    backgroundColor: 'rgba(20, 184, 166, 0.1)',
    color: '#0D9488',
    border: '1px solid rgba(20, 184, 166, 0.3)',
  },
  danger: {
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
    color: '#BE123C',
    border: '1px solid rgba(225, 29, 72, 0.25)',
  },
  success: {
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
    color: '#15803D',
    border: '1px solid rgba(22, 163, 74, 0.25)',
  },
  warning: {
    backgroundColor: 'rgba(234, 179, 8, 0.08)',
    color: '#A16207',
    border: '1px solid rgba(234, 179, 8, 0.25)',
  },
};

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
  if (selectedCount === 0) return null;

  const handleAction = (action: BulkAction) => {
    if (action.confirm) {
      if (!window.confirm(action.confirm.replace('{count}', String(selectedCount)))) return;
    }
    onAction(action.key);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        backgroundColor: '#0B1F3A',
        borderRadius: 12,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 12px 40px rgba(11, 31, 58, 0.35)',
        color: '#FFFFFF',
        minWidth: 400,
        maxWidth: '90vw',
      }}
    >
      {/* Selection info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span
          style={{
            backgroundColor: '#14B8A6',
            color: '#FFFFFF',
            borderRadius: 6,
            padding: '2px 10px',
            fontSize: '0.85rem',
            fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {selectedCount}
        </span>
        <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)' }}>
          selected
        </span>
      </div>

      {/* Select all / Deselect */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {!allSelected && (
          <button
            onClick={onSelectAll}
            style={{
              background: 'none',
              border: 'none',
              color: '#14B8A6',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '4px 8px',
            }}
          >
            Select all {totalCount}
          </button>
        )}
        <button
          onClick={onDeselectAll}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          Clear
        </button>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {actions.map((action) => {
          const style = variantStyles[action.variant || 'default'];
          const isLoading = loading === action.key;
          return (
            <button
              key={action.key}
              onClick={() => handleAction(action)}
              disabled={!!loading}
              style={{
                ...style,
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: loading && !isLoading ? 0.5 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              {isLoading ? (
                <svg className="animate-spin" style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" style={{ opacity: 0.75 }} />
                </svg>
              ) : action.icon ? (
                action.icon
              ) : null}
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
