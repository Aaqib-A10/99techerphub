// CSV Export Service
export function escapeCsvField(field: string | number | boolean | null | undefined): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV(
  rows: any[],
  columns: Array<{ key: string; label: string }>
): string {
  const headerRow = columns.map((col) => col.label).join(',');
  const dataRows = rows.map((row) =>
    columns.map((col) => escapeCsvField(row[col.key])).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

// HTML Export Service (for printing/PDF)
export function exportToHTML(
  title: string,
  rows: any[],
  columns: Array<{ key: string; label: string }>
): string {
  const tableRows = rows
    .map(
      (row) => `
      <tr>
        ${columns.map((col) => `<td>${escapeCsvField(row[col.key])}</td>`).join('')}
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          margin: 20px;
          color: #333;
        }
        h1 {
          color: #00C853;
          margin-bottom: 10px;
          font-size: 24px;
        }
        .metadata {
          color: #666;
          font-size: 14px;
          margin-bottom: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        thead {
          background-color: #f5f5f5;
        }
        th {
          border: 1px solid #ddd;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          background-color: #f5f5f5;
          color: #333;
        }
        td {
          border: 1px solid #ddd;
          padding: 10px 12px;
        }
        tr:nth-child(even) {
          background-color: #fafafa;
        }
        tr:hover {
          background-color: #f0f0f0;
        }
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          table {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="metadata">
        Generated on: ${new Date().toLocaleString()}
      </div>
      <table>
        <thead>
          <tr>
            ${columns.map((col) => `<th>${col.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </body>
    </html>
  `;
}
