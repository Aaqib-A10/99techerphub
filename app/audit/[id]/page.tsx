import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHero from '@/app/components/PageHero';

function getRecordLink(tableName: string, recordId: number): string | null {
  const routeMap: Record<string, string> = {
    Asset: `/assets/${recordId}`,
    Employee: `/employees/${recordId}`,
    Expense: `/expenses/${recordId}`,
    PayrollRun: `/finance/payroll/${recordId}`,
    MonthlyReport: `/finance/reports/monthly/${recordId}`,
  };
  return routeMap[tableName] || null;
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function getFieldChangeType(
  field: string,
  oldValue: any,
  newValue: any
): 'created' | 'changed' | 'deleted' {
  if (oldValue === null || oldValue === undefined) return 'created';
  if (newValue === null || newValue === undefined) return 'deleted';
  return 'changed';
}

export default async function AuditDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const auditId = parseInt(params.id);

  const auditLog = await prisma.auditLog.findUnique({
    where: { id: auditId },
    include: {
      changedBy: {
        include: { employee: true },
      },
    },
  });

  if (!auditLog) {
    notFound();
  }

  const oldValues = typeof auditLog.oldValues === 'string' ? JSON.parse(auditLog.oldValues) : auditLog.oldValues || {};
  const newValues = typeof auditLog.newValues === 'string' ? JSON.parse(auditLog.newValues) : auditLog.newValues || {};

  // Determine all fields that changed
  const allFields = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
  const changedFields = Array.from(allFields).filter(
    (field) => JSON.stringify(oldValues[field]) !== JSON.stringify(newValues[field])
  );

  const recordLink = getRecordLink(auditLog.tableName, auditLog.recordId);
  const changedByName = auditLog.changedBy?.employee
    ? `${auditLog.changedBy.employee.firstName} ${auditLog.changedBy.employee.lastName}`
    : auditLog.changedBy?.email || 'System';

  const actionBadgeColor: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-800',
    UPDATE: 'bg-yellow-100 text-yellow-800',
    DELETE: 'bg-red-100 text-red-800',
  };

  return (
    <div>
      <PageHero
        eyebrow="System / Audit Trail"
        title="Audit Log Detail"
        description={`ID: ${auditLog.id}`}
        actions={
          <>
            <span className={`px-4 py-2 rounded-full text-sm font-bold ${actionBadgeColor[auditLog.action] || 'bg-gray-100 text-gray-800'}`}>
              {auditLog.action}
            </span>
            <Link href="/audit" className="btn btn-secondary">
              ← Back
            </Link>
          </>
        }
      />

      {/* Header Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-bold">Record Information</h3>
          </div>
          <div className="card-body space-y-3">
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">Table</p>
              <p className="text-lg font-semibold text-gray-900">{auditLog.tableName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">Record ID</p>
              <p className="text-lg font-semibold text-gray-900">{auditLog.recordId}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">Module</p>
              <p className="text-lg font-semibold text-gray-900">{auditLog.module || 'N/A'}</p>
            </div>
            {recordLink && (
              <Link href={recordLink} className="text-brand-primary hover:text-brand-secondary font-medium text-sm mt-4 inline-block">
                View Record →
              </Link>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-bold">Change Information</h3>
          </div>
          <div className="card-body space-y-3">
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">Changed By</p>
              <p className="text-lg font-semibold text-gray-900">{changedByName}</p>
            </div>
            {auditLog.changedBy?.email && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide">Email</p>
                <p className="text-sm font-mono text-gray-700">{auditLog.changedBy.email}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">Timestamp</p>
              <p className="text-sm text-gray-900">{new Date(auditLog.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-bold">Connection Information</h3>
          </div>
          <div className="card-body space-y-3">
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">IP Address</p>
              <p className="text-sm font-mono text-gray-900">{auditLog.ipAddress || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">Fields Changed</p>
              <p className="text-lg font-semibold text-gray-900">{changedFields.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Changes Detail */}
      {changedFields.length > 0 && (
        <div className="card mb-8">
          <div className="card-header">
            <h3 className="text-sm font-bold">Changed Fields</h3>
          </div>
          <div className="card-body">
            <div className="space-y-6">
              {changedFields.map((field) => {
                const oldVal = oldValues[field];
                const newVal = newValues[field];
                const changeType = getFieldChangeType(field, oldVal, newVal);

                return (
                  <div key={field} className="pb-6 border-b border-gray-200 last:border-b-0">
                    <div className="flex items-center gap-3 mb-4">
                      <h4 className="font-semibold text-gray-900 text-lg">{field}</h4>
                      <span
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          changeType === 'created'
                            ? 'bg-green-100 text-green-800'
                            : changeType === 'deleted'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {changeType === 'created'
                          ? 'CREATED'
                          : changeType === 'deleted'
                            ? 'DELETED'
                            : 'CHANGED'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Before */}
                      <div>
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Before</p>
                        <div className="bg-red-50 border border-red-200 rounded p-4 font-mono text-sm text-red-900 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                          {formatValue(oldVal) || '(empty)'}
                        </div>
                      </div>

                      {/* After */}
                      <div>
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">After</p>
                        <div className="bg-green-50 border border-green-200 rounded p-4 font-mono text-sm text-green-900 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                          {formatValue(newVal) || '(empty)'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Raw JSON View */}
      <div className="card">
        <details className="group">
          <summary className="cursor-pointer p-4 hover:bg-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-bold">Raw JSON Data</h3>
            <svg
              className="w-5 h-5 text-gray-600 group-open:rotate-180 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </summary>
          <div className="card-body p-4 border-t border-gray-200 bg-gray-50">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Old Values</p>
                <pre className="bg-white border border-gray-300 rounded p-4 text-xs overflow-x-auto text-gray-800 max-h-64 overflow-y-auto">
                  {JSON.stringify(oldValues, null, 2) || '{}'}
                </pre>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">New Values</p>
                <pre className="bg-white border border-gray-300 rounded p-4 text-xs overflow-x-auto text-gray-800 max-h-64 overflow-y-auto">
                  {JSON.stringify(newValues, null, 2) || '{}'}
                </pre>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
