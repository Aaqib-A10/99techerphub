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
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200/95 bg-white pl-2.5 pr-2 text-[12.5px] font-medium text-zinc-700 transition-all duration-150 hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-60"
        title="Export the currently filtered data"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="text-zinc-400" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3" />
        </svg>
        {loadingLabel || 'Export'}
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
          className={`text-zinc-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-md border border-zinc-200/85 bg-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.12)]">
          <button
            type="button"
            onClick={() => handleExport('xlsx')}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-emerald-50 text-emerald-600">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M8 13h2 M14 13h2 M8 17h2 M14 17h2" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="font-medium text-zinc-900">Excel (.xlsx)</div>
              <div className="text-[10.5px] text-zinc-500">Formatted spreadsheet</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="flex w-full items-center gap-2.5 border-t border-zinc-100 px-3 py-2 text-left text-[12.5px] text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-zinc-100 text-zinc-600">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="font-medium text-zinc-900">CSV (.csv)</div>
              <div className="text-[10.5px] text-zinc-500">Plain text, any tool</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
