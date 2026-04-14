import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const reportId = searchParams.get('reportId');
    const format = searchParams.get('format') || 'csv';

    if (!reportId) {
      return NextResponse.json({ error: 'reportId is required' }, { status: 400 });
    }

    if (!['csv', 'html'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format (csv or html)' }, { status: 400 });
    }

    const report = await prisma.monthlyReport.findUnique({
      where: { id: parseInt(reportId) },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const summary = report.summary as any;

    // Create a structured report format
    const reportSections = [
      {
        title: 'EXPENSE SUMMARY',
        items: [
          { label: 'Total Expense Amount', value: `PKR ${(summary.totalExpenseAmount as number)?.toFixed(2) || '0.00'}` },
          { label: 'Total Expense Count', value: (summary.totalExpenseCount as number) || 0 },
          { label: 'Approved Expense Amount', value: `PKR ${(summary.approvedExpenseAmount as number)?.toFixed(2) || '0.00'}` },
          { label: 'Pending Expenses', value: (summary.pendingExpenses as number) || 0 },
        ],
      },
      {
        title: 'PAYROLL SUMMARY',
        items: [
          { label: 'Gross Payroll', value: `PKR ${(summary.payrollGross as number)?.toFixed(2) || '0.00'}` },
          { label: 'Net Payroll', value: `PKR ${(summary.payrollNet as number)?.toFixed(2) || '0.00'}` },
          { label: 'Total Deductions', value: `PKR ${(summary.payrollDeductions as number)?.toFixed(2) || '0.00'}` },
          { label: 'Employees Processed', value: (summary.payrollEmployees as number) || 0 },
        ],
      },
      {
        title: 'WORKFORCE SUMMARY',
        items: [
          { label: 'Total Headcount', value: (summary.headcount as number) || 0 },
          { label: 'New Hires', value: (summary.newHires as number) || 0 },
          { label: 'Exits', value: (summary.exits as number) || 0 },
        ],
      },
      {
        title: 'ASSET SUMMARY',
        items: [
          { label: 'Total Assets', value: (summary.totalAssets as number) || 0 },
          { label: 'New Assets', value: (summary.newAssets as number) || 0 },
        ],
      },
    ];

    if (format === 'csv') {
      // CSV format: flat key-value pairs
      let csv = 'Monthly Report Summary\n\n';
      csv += `Report Period,${report.period}\n`;
      csv += `Title,${report.title}\n`;
      csv += `Status,${report.status}\n`;
      csv += `Generated,${new Date(report.createdAt).toLocaleString()}\n\n`;

      for (const section of reportSections) {
        csv += `${section.title}\n`;
        for (const item of section.items) {
          csv += `${item.label},${item.value}\n`;
        }
        csv += '\n';
      }

      if (report.notes) {
        csv += `Notes,${report.notes}\n`;
      }

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="monthly-report-${report.period}.csv"`,
        },
      });
    } else {
      // HTML format: nicely formatted report
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Monthly Report - ${report.period}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              margin: 0;
              padding: 20px;
              background-color: #f5f5f5;
              color: #333;
            }
            .container {
              max-width: 900px;
              margin: 0 auto;
              background-color: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 {
              color: #00C853;
              margin: 0 0 10px 0;
              font-size: 32px;
            }
            .meta {
              color: #666;
              font-size: 14px;
              margin-bottom: 30px;
              border-bottom: 2px solid #f0f0f0;
              padding-bottom: 20px;
            }
            .section {
              margin-bottom: 30px;
            }
            .section h2 {
              color: #009624;
              font-size: 18px;
              margin: 0 0 15px 0;
              border-left: 4px solid #00C853;
              padding-left: 15px;
            }
            .section-items {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
            }
            .item {
              padding: 12px;
              background-color: #f9f9f9;
              border-radius: 4px;
              border-left: 3px solid #00C853;
            }
            .item-label {
              font-size: 12px;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 5px;
            }
            .item-value {
              font-size: 20px;
              font-weight: 600;
              color: #333;
            }
            .notes {
              background-color: #f0f8f0;
              border-left: 4px solid #00C853;
              padding: 15px;
              margin-top: 30px;
              border-radius: 4px;
            }
            @media print {
              body {
                background-color: white;
              }
              .container {
                box-shadow: none;
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Monthly Report</h1>
            <div class="meta">
              <div><strong>Period:</strong> ${report.period}</div>
              <div><strong>Title:</strong> ${report.title}</div>
              <div><strong>Status:</strong> ${report.status}</div>
              <div><strong>Generated:</strong> ${new Date(report.createdAt).toLocaleString()}</div>
            </div>

            ${reportSections
              .map(
                (section) => `
              <div class="section">
                <h2>${section.title}</h2>
                <div class="section-items">
                  ${section.items
                    .map(
                      (item) => `
                    <div class="item">
                      <div class="item-label">${item.label}</div>
                      <div class="item-value">${item.value}</div>
                    </div>
                  `
                    )
                    .join('')}
                </div>
              </div>
            `
              )
              .join('')}

            ${
              report.notes
                ? `
              <div class="notes">
                <strong>Notes:</strong><br/>
                ${report.notes}
              </div>
            `
                : ''
            }
          </div>
        </body>
        </html>
      `;

      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="monthly-report-${report.period}.html"`,
        },
      });
    }
  } catch (error) {
    console.error('Monthly report export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
