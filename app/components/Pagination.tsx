'use client';

import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Pagination + page-size switcher used by the Assets index.
 *
 * - Page size options: 25 / 50 / 100 / 200 / All
 * - "All" is stored in the URL as `pageSize=all` and interpreted
 *   server-side as "do not limit".
 * - Changing page size resets page to 1.
 * - Prev/Next disabled when at the boundary.
 */
export default function Pagination({
  page,
  pageSize,
  total,
  showing,
  basePath = '/assets',
}: {
  page: number;
  pageSize: number | 'all';
  total: number;
  showing: number;
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageSizeNum = pageSize === 'all' ? Math.max(total, 1) : pageSize;
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(total / pageSizeNum));
  const fromIdx = total === 0 ? 0 : (page - 1) * pageSizeNum + 1;
  const toIdx = Math.min(page * pageSizeNum, total);

  const goto = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete('page');
    else params.set('page', String(nextPage));
    router.push(`${basePath}?${params.toString()}`);
  };

  const setPageSize = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === '50') params.delete('pageSize');
    else params.set('pageSize', value);
    params.delete('page');
    router.push(`${basePath}?${params.toString()}`);
  };

  // Compact page-number range around the current page (±2)
  const pages: (number | 'ellipsis')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    const near = new Set<number>();
    near.add(1);
    near.add(totalPages);
    for (let i = page - 2; i <= page + 2; i++) {
      if (i >= 1 && i <= totalPages) near.add(i);
    }
    const sorted = Array.from(near).sort((a, b) => a - b);
    let prev = 0;
    for (const n of sorted) {
      if (prev && n - prev > 1) pages.push('ellipsis');
      pages.push(n);
      prev = n;
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: row counter + page-size switcher */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <span>
          {total === 0
            ? 'No assets'
            : pageSize === 'all'
              ? `Showing all ${total} assets`
              : `Showing ${fromIdx.toLocaleString()}–${toIdx.toLocaleString()} of ${total.toLocaleString()}`}
        </span>

        <label className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Per page</span>
          <select
            value={String(pageSize)}
            onChange={(e) => setPageSize(e.target.value)}
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm shadow-sm focus:border-brand-primary focus:outline-none"
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="500">500</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      {/* Right: page nav */}
      {pageSize !== 'all' && totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goto(page - 1)}
            disabled={page <= 1}
            className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm transition hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-700"
          >
            ← Prev
          </button>

          {pages.map((p, idx) =>
            p === 'ellipsis' ? (
              <span key={`e-${idx}`} className="px-2 text-gray-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => goto(p)}
                className={`min-w-[2.25rem] rounded-md px-3 py-1 text-sm font-medium shadow-sm transition ${
                  p === page
                    ? 'bg-brand-primary text-white'
                    : 'border border-gray-200 bg-white text-gray-700 hover:border-brand-primary hover:text-brand-primary'
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => goto(page + 1)}
            disabled={page >= totalPages}
            className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm transition hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-700"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
