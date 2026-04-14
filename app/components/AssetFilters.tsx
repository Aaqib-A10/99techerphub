'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

interface Company {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
}

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  empCode: string;
}

export default function AssetFilters({
  companies,
  categories,
  employees,
}: {
  companies: Company[];
  categories: Category[];
  employees: Employee[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local state for text specs so typing feels instant.
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [ram, setRam] = useState(searchParams.get('ram') || '');
  const [storage, setStorage] = useState(searchParams.get('storage') || '');
  const [cpu, setCpu] = useState(searchParams.get('cpu') || '');
  const [gpu, setGpu] = useState(searchParams.get('gpu') || '');

  // Debounced URL update when typing in search / spec filters.
  // We reset the page back to 1 any time a filter changes so the user
  // isn't stuck on page 5 of an empty result set.
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      setOrDelete(params, 'q', q);
      setOrDelete(params, 'ram', ram);
      setOrDelete(params, 'storage', storage);
      setOrDelete(params, 'cpu', cpu);
      setOrDelete(params, 'gpu', gpu);
      params.delete('page');
      router.push(`/assets?${params.toString()}`);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, ram, storage, cpu, gpu]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    setOrDelete(params, key, value);
    params.delete('page');
    router.push(`/assets?${params.toString()}`);
  };

  const clearAll = () => {
    setQ('');
    setRam('');
    setStorage('');
    setCpu('');
    setGpu('');
    // Preserve pageSize when clearing filters so the user's preference sticks.
    const pageSize = searchParams.get('pageSize');
    const params = new URLSearchParams();
    if (pageSize) params.set('pageSize', pageSize);
    router.push(`/assets${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const hasAnyFilter =
    !!searchParams.get('assetType') ||
    !!searchParams.get('companyId') ||
    !!searchParams.get('categoryId') ||
    !!searchParams.get('condition') ||
    !!searchParams.get('assignment') ||
    !!searchParams.get('employeeId') ||
    !!q ||
    !!ram ||
    !!storage ||
    !!cpu ||
    !!gpu;

  return (
    <div className="space-y-3">
      {/* Row 0 — global search across tag / model / manufacturer / serial */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search asset tag, model, manufacturer, serial, or holder…"
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
        />
      </div>

      {/* Row 1 — classification filters */}
      <div className="filter-bar">
        <div className="filter-item">
          <label>Type</label>
          <select
            value={searchParams.get('assetType') || ''}
            onChange={(e) => updateFilter('assetType', e.target.value)}
            className="form-select"
          >
            <option value="">All Types</option>
            <option value="HARDWARE">Hardware</option>
            <option value="SOFTWARE">Software</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Company</label>
          <select
            value={searchParams.get('companyId') || ''}
            onChange={(e) => updateFilter('companyId', e.target.value)}
            className="form-select"
          >
            <option value="">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Category</label>
          <select
            value={searchParams.get('categoryId') || ''}
            onChange={(e) => updateFilter('categoryId', e.target.value)}
            className="form-select"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Condition</label>
          <select
            value={searchParams.get('condition') || ''}
            onChange={(e) => updateFilter('condition', e.target.value)}
            className="form-select"
          >
            <option value="">All Conditions</option>
            <option value="NEW">New</option>
            <option value="WORKING">Working</option>
            <option value="DAMAGED">Damaged</option>
            <option value="IN_REPAIR">In Repair</option>
            <option value="LOST">Lost</option>
            <option value="RETIRED">Retired</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Status</label>
          <select
            value={searchParams.get('assignment') || ''}
            onChange={(e) => updateFilter('assignment', e.target.value)}
            className="form-select"
          >
            <option value="">All Assets</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Un-assigned</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Assigned Employee</label>
          <select
            value={searchParams.get('employeeId') || ''}
            onChange={(e) => updateFilter('employeeId', e.target.value)}
            className="form-select"
          >
            <option value="">All Employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName} ({emp.empCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2 — hardware specification filters */}
      <div className="filter-bar">
        <div className="filter-item">
          <label>RAM</label>
          <input
            type="text"
            value={ram}
            onChange={(e) => setRam(e.target.value)}
            placeholder="e.g. 16"
            className="form-input"
          />
        </div>

        <div className="filter-item">
          <label>Storage / SSD</label>
          <input
            type="text"
            value={storage}
            onChange={(e) => setStorage(e.target.value)}
            placeholder="e.g. 512"
            className="form-input"
          />
        </div>

        <div className="filter-item">
          <label>Processor</label>
          <input
            type="text"
            value={cpu}
            onChange={(e) => setCpu(e.target.value)}
            placeholder="e.g. i7"
            className="form-input"
          />
        </div>

        <div className="filter-item">
          <label>GPU</label>
          <input
            type="text"
            value={gpu}
            onChange={(e) => setGpu(e.target.value)}
            placeholder="e.g. RTX"
            className="form-input"
          />
        </div>

        {hasAnyFilter && (
          <div className="filter-item flex items-end">
            <button
              type="button"
              onClick={clearAll}
              className="text-sm text-gray-600 hover:text-red-600 underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value && value.trim()) {
    params.set(key, value.trim());
  } else {
    params.delete(key);
  }
}
