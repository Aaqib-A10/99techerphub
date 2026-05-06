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

  // CSV stays a download — accountants paste it into Excel.
  const handleCsvExport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/export/monthly-report?reportId=${reportId}&format=csv`,
      );
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `monthly-report-${period}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export report as CSV. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // PDF flow: open the HTML report in a new tab with autoprint=1; the
  // page calls window.print() on load, the browser's Print dialog
  // pops up, user picks "Save as PDF" as the destination. No
  // server-side PDF library needed and the result respects the @media
  // print CSS the report ships with.
  const handlePdfExport = () => {
    const url = `/api/export/monthly-report?reportId=${reportId}&format=html&autoprint=1`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handleCsvExport}
        disabled={isLoading}
        className="btn btn-secondary text-sm inline-flex items-center gap-2"
        title="Download a CSV of the summary"
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
        onClick={handlePdfExport}
        className="btn btn-secondary text-sm inline-flex items-center gap-2"
        title="Open the printable report — pick Save as PDF in the print dialog"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M9 14h6 M9 18h6"
          />
        </svg>
        PDF
      </button>
    </div>
  );
}
