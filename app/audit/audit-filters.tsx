'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useCallback } from 'react';

interface AuditFiltersProps {
  initialModule: string;
  initialAction: string;
  initialFromDate: string;
  initialToDate: string;
  initialSearch: string;
}

export default function AuditFilters({
  initialModule,
  initialAction,
  initialFromDate,
  initialToDate,
  initialSearch,
}: AuditFiltersProps) {
  const router = useRouter();
  const [module, setModule] = useState(initialModule);
  const [action, setAction] = useState(initialAction);
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [search, setSearch] = useState(initialSearch);

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();

    if (module && module !== 'ALL') params.set('module', module);
    if (action && action !== 'ALL') params.set('action', action);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    if (search) params.set('search', search);

    const queryString = params.toString();
    router.push(`/audit${queryString ? `?${queryString}` : ''}`);
  }, [module, action, fromDate, toDate, search, router]);

  const clearFilters = useCallback(() => {
    setModule('ALL');
    setAction('ALL');
    setFromDate('');
    setToDate('');
    setSearch('');
    router.push('/audit');
  }, [router]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Module</label>
          <select
            value={module}
            onChange={(e) => setModule(e.target.value)}
            className="form-input"
          >
            <option value="ALL">All Modules</option>
            <option value="ASSET">Assets</option>
            <option value="EMPLOYEE">Employees</option>
            <option value="EXPENSE">Expenses</option>
            <option value="FINANCE">Finance</option>
            <option value="PAYROLL">Payroll</option>
          </select>
        </div>

        <div>
          <label className="form-label">Action</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="form-input"
          >
            <option value="ALL">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="form-input"
          />
        </div>

        <div>
          <label className="form-label">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="form-input"
          />
        </div>
      </div>

      <div>
        <label className="form-label">Search (Record ID, Table Name, or User)</label>
        <input
          type="text"
          placeholder="Search audit logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={applyFilters}
          className="btn btn-primary"
        >
          Apply Filters
        </button>
        <button
          onClick={clearFilters}
          className="btn btn-secondary"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}
