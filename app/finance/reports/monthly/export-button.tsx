'use client';

import { useState } from 'react';

interface MonthlyReportExportButtonProps {
  reportId: number;
  period: string;
}

export default function MonthlyReportExportButton({
  reportId,
  period,
}: MonthlyReportExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async (format: 'csv' | 'html') => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/export/monthly-report?reportId=${reportId}&format=${format}`
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `monthly-report-${period}.${format === 'csv' ? 'csv' : 'html'}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert(`Failed to export report as ${format.toUpperCase()}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleExport('csv')}
        disabled={isLoading}
        className="btn btn-secondary text-sm inline-flex items-center gap-2"
        title="Export report to CSV"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        CSV
      </button>
      <button
        onClick={() => handleExport('html')}
        disabled={isLoading}
        className="btn btn-secondary text-sm inline-flex items-center gap-2"
        title="Export report to HTML (for printing/PDF)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        Print
      </button>
    </div>
  );
}
