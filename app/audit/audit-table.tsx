'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface AuditLog {
  id: number;
  tableName: string;
  recordId: number;
  action: string;
  module: string | null;
  oldValues: any;
  newValues: any;
  createdAt: string;
  changedBy: {
    id: number;
    email: string;
    employee: {
      firstName: string;
      lastName: string;
    } | null;
  } | null;
}

interface AuditTableProps {
  page: number;
  module: string;
  action: string;
  fromDate: string;
  toDate: string;
  search: string;
}

const moduleColors: Record<string, string> = {
  ASSET: 'badge-green',
  EMPLOYEE: 'badge-blue',
  EXPENSE: 'badge-orange',
  FINANCE: 'badge-purple',
  PAYROLL: 'badge-indigo',
};

const actionColors: Record<string, string> = {
  CREATE: 'bg-core-greenSoft text-core-greenFg',
  UPDATE: 'bg-core-amberSoft text-core-amberFg',
  DELETE: 'bg-core-roseSoft text-core-roseFg',
};

export default function AuditTable({
  page,
  module,
  action,
  fromDate,
  toDate,
  search,
}: AuditTableProps) {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', page.toString());
        params.set('limit', '25');
        if (module && module !== 'ALL') params.set('module', module);
        if (action && action !== 'ALL') params.set('action', action);
        if (fromDate) params.set('fromDate', fromDate);
        if (toDate) params.set('toDate', toDate);
        if (search) params.set('search', search);

        const response = await fetch(`/api/audit?${params.toString()}`);
        const data = await response.json();

        setLogs(data.logs);
        setPagination(data.pagination);
      } catch (error) {
        console.error('Error fetching audit logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [page, module, action, fromDate, toDate, search]);

  const handlePrevious = () => {
    if (page > 1) {
      const params = new URLSearchParams();
      params.set('page', (page - 1).toString());
      if (module && module !== 'ALL') params.set('module', module);
      if (action && action !== 'ALL') params.set('action', action);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      if (search) params.set('search', search);

      router.push(`/audit?${params.toString()}`);
    }
  };

  const handleNext = () => {
    if (page < pagination.totalPages) {
      const params = new URLSearchParams();
      params.set('page', (page + 1).toString());
      if (module && module !== 'ALL') params.set('module', module);
      if (action && action !== 'ALL') params.set('action', action);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      if (search) params.set('search', search);

      router.push(`/audit?${params.toString()}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const getUserDisplayName = (changedBy: AuditLog['changedBy']): string => {
    if (!changedBy) return 'System';
    if (changedBy.employee?.firstName && changedBy.employee?.lastName) {
      return `${changedBy.employee.firstName} ${changedBy.employee.lastName}`;
    }
    return changedBy.email;
  };

  const getValueDiff = (oldValues: any, newValues: any) => {
    if (!oldValues && !newValues) return [];

    const allKeys = new Set([
      ...Object.keys(oldValues || {}),
      ...Object.keys(newValues || {}),
    ]);

    return Array.from(allKeys)
      .map((key) => ({
        key,
        oldValue: oldValues?.[key],
        newValue: newValues?.[key],
      }))
      .filter(
        (item) =>
          item.oldValue !== item.newValue || item.oldValue !== undefined
      );
  };

  if (loading) {
    return (
      <div className="card">
        <div className="p-8 text-center text-core-text3">
          Loading audit logs...
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header flex justify-between items-center">
        <h2 className="section-heading">Audit Logs</h2>
        <span className="text-sm text-core-text3">
          Showing {logs.length} of {pagination.total} records
        </span>
      </div>

      <div className="table-wrapper">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-core-text3">
            No audit logs found
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Module</th>
                <th>Action</th>
                <th>Table</th>
                <th>Record ID</th>
                <th>Changed By</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => router.push(`/audit/${log.id}`)}
                  className="cursor-pointer transition-colors hover:bg-core-surface2"
                >
                  <td className="text-sm whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </td>
                  <td>
                    {log.module ? (
                      <span
                        className={`badge ${
                          moduleColors[log.module] || 'badge-gray'
                        }`}
                      >
                        {log.module}
                      </span>
                    ) : (
                      <span className="text-core-text3">-</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        actionColors[log.action] || 'bg-core-surface2 text-core-text'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="font-mono text-sm">{log.tableName}</td>
                  <td className="font-mono text-sm">{log.recordId}</td>
                  <td className="text-sm">
                    {getUserDisplayName(log.changedBy)}
                  </td>
                  <td className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() =>
                        setExpandedId(
                          expandedId === log.id ? null : log.id
                        )
                      }
                      className="text-core-text2 hover:underline text-sm font-medium"
                    >
                      {expandedId === log.id ? 'Hide' : 'Show'} Changes
                    </button>
                    <Link
                      href={`/audit/${log.id}`}
                      className="text-core-text2 hover:text-core-greenFg text-sm font-medium"
                    >
                      View Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {logs.length > 0 && expandedId && (
        <div className="border-t border-core-border p-4 bg-core-surface2">
          {logs.find((log) => log.id === expandedId) && (
            <ChangeDetails log={logs.find((log) => log.id === expandedId)!} />
          )}
        </div>
      )}

      <div className="flex items-center justify-between p-4 border-t border-core-border">
        <div className="text-sm text-core-text2">
          Page {pagination.page} of {pagination.totalPages || 1}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrevious}
            disabled={page === 1}
            className="px-4 py-2 bg-core-border text-core-text2 rounded-lg hover:bg-core-border disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Previous
          </button>
          <button
            onClick={handleNext}
            disabled={page >= pagination.totalPages}
            className="px-4 py-2 bg-core-border text-core-text2 rounded-lg hover:bg-core-border disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangeDetails({ log }: { log: AuditLog }) {
  const getChangeDiff = (oldValues: any, newValues: any) => {
    if (!oldValues && !newValues) return [];

    const allKeys = new Set([
      ...Object.keys(oldValues || {}),
      ...Object.keys(newValues || {}),
    ]);

    return Array.from(allKeys)
      .map((key) => ({
        key,
        oldValue: oldValues?.[key],
        newValue: newValues?.[key],
      }))
      .filter(
        (item) =>
          item.oldValue !== item.newValue || item.oldValue !== undefined
      );
  };

  const diff = getChangeDiff(log.oldValues, log.newValues);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-core-text mb-3">Changed Fields</h3>
      {diff.map((field) => (
        <div key={field.key} className="grid grid-cols-2 gap-4 p-3 bg-core-surface rounded border border-core-border">
          <div>
            <p className="text-xs text-core-text2 font-medium mb-1">
              Old: {field.key}
            </p>
            <div className="bg-core-roseSoft p-2 rounded border border-core-border">
              <code className="text-xs text-core-roseFg whitespace-pre-wrap break-words">
                {field.oldValue === null
                  ? '(null)'
                  : typeof field.oldValue === 'object'
                    ? JSON.stringify(field.oldValue, null, 2)
                    : String(field.oldValue)}
              </code>
            </div>
          </div>
          <div>
            <p className="text-xs text-core-text2 font-medium mb-1">
              New: {field.key}
            </p>
            <div className="bg-core-greenSoft p-2 rounded border border-core-border">
              <code className="text-xs text-core-greenFg whitespace-pre-wrap break-words">
                {field.newValue === null
                  ? '(null)'
                  : typeof field.newValue === 'object'
                    ? JSON.stringify(field.newValue, null, 2)
                    : String(field.newValue)}
              </code>
            </div>
          </div>
        </div>
      ))}
      {diff.length === 0 && (
        <p className="text-sm text-core-text3">No changed fields</p>
      )}
    </div>
  );
}
