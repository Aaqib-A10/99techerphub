import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ExpenseDetailClient from './client';
import PageHero from '@/app/components/PageHero';

export default async function ExpenseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const expense = await prisma.expense.findUnique({
    where: { id: parseInt(params.id) },
    include: {
      category: true,
      company: true,
      department: true,
      submittedBy: true,
      approvals: {
        include: { approvedBy: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!expense) return notFound();

  // Fetch related audit logs
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      tableName: 'expenses',
      recordId: expense.id,
    },
    include: {
      changedBy: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const statusColors: Record<string, string> = {
    DRAFT: 'badge-gray',
    PENDING: 'badge-yellow',
    APPROVED: 'badge-green',
    REJECTED: 'badge-red',
    NEEDS_REVISION: 'badge-blue',
  };

  const statusFlow = {
    PENDING: ['APPROVED', 'REJECTED', 'NEEDS_REVISION'],
    DRAFT: ['PENDING', 'APPROVED', 'REJECTED'],
    NEEDS_REVISION: ['APPROVED', 'REJECTED'],
    APPROVED: [],
    REJECTED: [],
  };

  return (
    <div>
      <div className="breadcrumb mb-6">
        <Link href="/expenses" className="breadcrumb-item">Expenses</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-item active">{expense.expenseNumber}</span>
      </div>

      <PageHero
        eyebrow="Finance / Expense Vault"
        title={expense.expenseNumber}
        description={expense.category.name}
        actions={
          <div className="text-right" style={{ color: '#FFFFFF' }}>
            <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              {expense.currency} {expense.amount.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)' }}>
              {new Date(expense.expenseDate).toLocaleDateString()}
            </div>
          </div>
        }
      >
        <div className="flex gap-2 mt-3">
          <span className={`badge ${statusColors[expense.status]}`}>
            {expense.status.replace(/_/g, ' ')}
          </span>
        </div>
      </PageHero>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Full Expense Details */}
          <div className="card">
            <div className="card-header">
              <h2 className="section-heading">Expense Details</h2>
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500 text-sm">Category</span>
                  <div className="font-medium mt-1">{expense.category.name}</div>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Company</span>
                  <div className="font-medium mt-1">{expense.company.name}</div>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Department</span>
                  <div className="font-medium mt-1">{expense.department?.name || '-'}</div>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Currency</span>
                  <div className="font-medium mt-1">{expense.currency}</div>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Submitted By</span>
                  <div className="font-medium mt-1">
                    {expense.submittedBy.firstName} {expense.submittedBy.lastName}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Expense Date</span>
                  <div className="font-medium mt-1">
                    {new Date(expense.expenseDate).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {expense.vendor && (
                <div className="pt-4 border-t">
                  <span className="text-gray-500 text-sm">Vendor</span>
                  <div className="font-medium mt-1">{expense.vendor}</div>
                </div>
              )}

              {expense.invoiceNumber && (
                <div className="pt-2 border-t">
                  <span className="text-gray-500 text-sm">Invoice Number</span>
                  <div className="font-medium mt-1">{expense.invoiceNumber}</div>
                </div>
              )}

              {expense.paymentMethod && (
                <div className="pt-2 border-t">
                  <span className="text-gray-500 text-sm">Payment Method</span>
                  <div className="font-medium mt-1">{expense.paymentMethod}</div>
                </div>
              )}

              <div className="pt-4 border-t">
                <span className="text-gray-500 text-sm">Description</span>
                <p className="mt-2 text-gray-700">{expense.description}</p>
              </div>

              {expense.rejectionReason && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
                  <span className="text-red-600 text-sm font-semibold">Rejection Reason</span>
                  <p className="mt-2 text-red-700">{expense.rejectionReason}</p>
                </div>
              )}

              {expense.revisionNotes && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                  <span className="text-blue-600 text-sm font-semibold">Revision Notes</span>
                  <p className="mt-2 text-blue-700">{expense.revisionNotes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Receipt Image Display */}
          {expense.receiptUrl && (
            <div className="card">
              <div className="card-header">
                <h2 className="section-heading">Receipt</h2>
              </div>
              <div className="card-body">
                {expense.receiptUrl.match(/\.(pdf)$/i) ? (
                  <a
                    href={expense.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-brand-primary hover:underline"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8m0 8l-6-2m6 2l6-2"
                      />
                    </svg>
                    View PDF Receipt
                  </a>
                ) : (
                  <div className="bg-gray-100 rounded overflow-hidden">
                    <img
                      src={expense.receiptUrl}
                      alt="Expense Receipt"
                      className="w-full h-auto max-h-96 object-contain"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status Flow Visualization */}
          <div className="card">
            <div className="card-header">
              <h2 className="section-heading">Status Flow</h2>
            </div>
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <div className={`inline-block p-3 rounded-full ${statusColors[expense.status].includes('gray') ? 'bg-gray-200' : statusColors[expense.status].includes('yellow') ? 'bg-yellow-200' : statusColors[expense.status].includes('green') ? 'bg-green-200' : statusColors[expense.status].includes('red') ? 'bg-red-200' : 'bg-blue-200'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="mt-2 font-semibold text-sm">{expense.status.replace(/_/g, ' ')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Approval History */}
          <div className="card">
            <div className="card-header">
              <h2 className="section-heading">Approval History</h2>
            </div>
            <div className="card-body">
              {expense.approvals.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No approval actions yet</p>
              ) : (
                <div className="space-y-4">
                  {expense.approvals.map((a: any) => (
                    <div
                      key={a.id}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className={`badge ${
                          a.action === 'APPROVED'
                            ? 'badge-green'
                            : a.action === 'REJECTED'
                            ? 'badge-red'
                            : 'badge-blue'
                        }`}>
                          {a.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(a.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        By <span className="font-medium">{a.approvedBy.email}</span>
                      </div>
                      {a.comments && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                          {a.comments}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Audit Trail */}
          {auditLogs.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="section-heading">Audit Trail</h2>
              </div>
              <div className="card-body">
                <div className="space-y-3">
                  {auditLogs.map((log: any) => (
                    <div key={log.id} className="p-3 bg-gray-50 rounded text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">
                          {log.action}
                        </span>
                        <span className="text-gray-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {log.changedBy && (
                        <div className="text-gray-600 text-xs mt-1">
                          By {log.changedBy.email}
                        </div>
                      )}
                      {log.newValues && (
                        <div className="text-gray-600 text-xs mt-1 font-mono">
                          {JSON.stringify(log.newValues).substring(0, 100)}...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Approval Actions */}
        <div>
          <ExpenseDetailClient expense={expense} />
        </div>
      </div>
    </div>
  );
}
