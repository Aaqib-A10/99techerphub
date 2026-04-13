'use client';

/**
 * Reusable client-side pagination footer for tables.
 * Shows: "Showing X–Y of Z" | Per-page selector (25/50/100/200) | Page nav with numbers
 */
export default function TablePagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}: {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (size: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const fromIdx = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const toIdx = Math.min(currentPage * itemsPerPage, totalItems);

  // Compact page-number range around the current page (±2)
  const pages: (number | 'ellipsis')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    const near = new Set<number>();
    near.add(1);
    near.add(totalPages);
    for (let i = currentPage - 2; i <= currentPage + 2; i++) {
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

  const handlePerPage = (val: string) => {
    onItemsPerPageChange(parseInt(val));
    onPageChange(1);
  };

  return (
    <div
      className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderTop: '1px solid rgba(196, 198, 206, 0.25)', backgroundColor: 'rgba(248, 249, 255, 0.5)' }}
    >
      {/* Left: row counter + page-size switcher */}
      <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: '#44474D' }}>
        <span>
          {totalItems === 0
            ? 'No records'
            : `Showing ${fromIdx}–${toIdx} of ${totalItems}`}
        </span>

        <label className="flex items-center gap-2">
          <span style={{ fontSize: '0.75rem', color: '#75777E' }}>Per page</span>
          <select
            value={String(itemsPerPage)}
            onChange={(e) => handlePerPage(e.target.value)}
            style={{
              borderRadius: 6,
              border: '1px solid rgba(196, 198, 206, 0.4)',
              backgroundColor: '#FFFFFF',
              padding: '4px 8px',
              fontSize: '0.85rem',
              color: '#0B1F3A',
              cursor: 'pointer',
            }}
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </label>
      </div>

      {/* Right: page nav */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            style={{
              borderRadius: 6,
              border: '1px solid rgba(196, 198, 206, 0.4)',
              backgroundColor: '#FFFFFF',
              padding: '4px 12px',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: currentPage <= 1 ? '#C4C6CE' : '#0B1F3A',
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage <= 1 ? 0.5 : 1,
            }}
          >
            ← Prev
          </button>

          {pages.map((p, idx) =>
            p === 'ellipsis' ? (
              <span key={`e-${idx}`} style={{ padding: '0 8px', color: '#C4C6CE' }}>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                style={{
                  minWidth: 36,
                  borderRadius: 6,
                  padding: '4px 12px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: p === currentPage ? '#0B1F3A' : '#FFFFFF',
                  color: p === currentPage ? '#FFFFFF' : '#0B1F3A',
                  border: p === currentPage ? 'none' : '1px solid rgba(196, 198, 206, 0.4)',
                }}
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            style={{
              borderRadius: 6,
              border: '1px solid rgba(196, 198, 206, 0.4)',
              backgroundColor: '#FFFFFF',
              padding: '4px 12px',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: currentPage >= totalPages ? '#C4C6CE' : '#0B1F3A',
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage >= totalPages ? 0.5 : 1,
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
