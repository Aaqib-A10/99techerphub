'use client';

import { useEffect, useRef, useState } from 'react';

interface ExportButtonProps {
  module: 'assets' | 'employees' | 'expenses';
  filters?: Record<string, string | number | boolean>;
}

type ExportFormat = 'csv' | 'xlsx';

export default function ExportButton({ module, filters = {} }: ExportButtonProps) {
  const [isLoading, setIsLoading] = useState<ExportFormat | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the menu when the user clicks outside.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleExport = async (format: ExportFormat) => {
    setIsLoading(format);
    setOpen(false);
    try {
      const params = new URLSearchParams();
      params.append('module', module);
      params.append('format', format);
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params.append(key, String(value));
        }
      });

      const response = await fetch(`/api/export?${params.toString()}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `${module}-export-${timestamp}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  const loadingLabel =
    isLoading === 'csv' ? 'Exporting CSV…' : isLoading === 'xlsx' ? 'Exporting Excel…' : null;

  return (
    <div className="relative inline-block" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={isLoading !== null}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-secondary hover:shadow active:scale-95 disabled:opacity-60"
        title="Export the currently filtered data"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {loadingLabel || 'Export'}
        <svg className="h-3 w-3 opacity-80" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => handleExport('xlsx')}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 transition hover:bg-gray-50"
          >
            <span className="text-base">📊</span>
            <div>
              <div className="font-semibold">Excel (.xlsx)</div>
              <div className="text-[11px] text-gray-500">Formatted spreadsheet</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-2.5 text-left text-sm text-gray-700 transition hover:bg-gray-50"
          >
            <span className="text-base">📄</span>
            <div>
              <div className="font-semibold">CSV (.csv)</div>
              <div className="text-[11px] text-gray-500">Plain text, any tool</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
