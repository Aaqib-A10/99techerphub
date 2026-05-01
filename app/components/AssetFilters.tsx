'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import FilterChip from '@/app/components/FilterChip';

interface Company {
  id: number;
  name: string;
}

interface Location {
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
  locations,
  categories,
  employees,
}: {
  companies: Company[];
  locations: Location[];
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
  const [advancedOpen, setAdvancedOpen] = useState(
    !!(searchParams.get('ram') || searchParams.get('storage') || searchParams.get('cpu') || searchParams.get('gpu'))
  );
  const advancedRef = useRef<HTMLDivElement>(null);

  // Debounced URL update for text inputs
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
    const pageSize = searchParams.get('pageSize');
    const params = new URLSearchParams();
    if (pageSize) params.set('pageSize', pageSize);
    router.push(`/assets${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const hasAnyFilter =
    !!searchParams.get('assetType') ||
    !!searchParams.get('companyId') ||
    !!searchParams.get('locationId') ||
    !!searchParams.get('categoryId') ||
    !!searchParams.get('condition') ||
    !!searchParams.get('assignment') ||
    !!searchParams.get('overdue') ||
    !!searchParams.get('employeeId') ||
    !!q ||
    !!ram ||
    !!storage ||
    !!cpu ||
    !!gpu;

  const specFilterCount = [ram, storage, cpu, gpu].filter(Boolean).length;

  // Outside-click to close advanced popover
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (advancedRef.current && !advancedRef.current.contains(e.target as Node)) {
        setAdvancedOpen(false);
      }
    };
    if (advancedOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [advancedOpen]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="group relative flex h-8 min-w-[260px] flex-1 items-center rounded-md border border-core-border/95 bg-core-surface pl-2.5 pr-2 transition-all duration-150 hover:border-core-border focus-within:border-zinc-400 focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.04)] sm:max-w-[340px]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="flex-shrink-0 text-core-text3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 21l-4.35-4.35 M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tag, model, serial, holder…"
          className="ml-2 flex-1 bg-transparent text-[12.5px] text-core-text placeholder:text-core-text3 focus:outline-none"
        />
      </div>

      <FilterChip
        value={searchParams.get('assetType') || ''}
        onChange={(v) => updateFilter('assetType', v)}
        options={[
          { value: 'HARDWARE', label: 'Hardware' },
          { value: 'SOFTWARE', label: 'Software' },
        ]}
        placeholder="All Types"
      />

      <FilterChip
        value={searchParams.get('companyId') || ''}
        onChange={(v) => updateFilter('companyId', v)}
        options={companies.map((c) => ({ value: c.id.toString(), label: c.name }))}
        placeholder="All Companies"
      />

      <FilterChip
        value={searchParams.get('locationId') || ''}
        onChange={(v) => updateFilter('locationId', v)}
        options={locations.map((l) => ({ value: l.id.toString(), label: l.name }))}
        placeholder="All Locations"
      />

      <FilterChip
        value={searchParams.get('categoryId') || ''}
        onChange={(v) => updateFilter('categoryId', v)}
        options={categories.map((c) => ({ value: c.id.toString(), label: c.name }))}
        placeholder="All Categories"
      />

      <FilterChip
        value={searchParams.get('condition') || ''}
        onChange={(v) => updateFilter('condition', v)}
        options={[
          { value: 'NEW', label: 'New' },
          { value: 'WORKING', label: 'Working' },
          { value: 'DAMAGED', label: 'Damaged' },
          { value: 'IN_REPAIR', label: 'In Repair' },
          { value: 'LOST', label: 'Lost' },
          { value: 'RETIRED', label: 'Retired' },
        ]}
        placeholder="All Conditions"
      />

      <FilterChip
        value={searchParams.get('assignment') || ''}
        onChange={(v) => updateFilter('assignment', v)}
        options={[
          { value: 'assigned', label: 'Assigned' },
          { value: 'unassigned', label: 'Un-assigned' },
        ]}
        placeholder="All Assets"
      />

      <FilterChip
        value={searchParams.get('employeeId') || ''}
        onChange={(v) => updateFilter('employeeId', v)}
        options={employees.map((e) => ({
          value: e.id.toString(),
          label: `${e.firstName} ${e.lastName} (${e.empCode})`,
        }))}
        placeholder="All Holders"
      />

      {/* Advanced specs popover */}
      <div ref={advancedRef} className="relative inline-block">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md border bg-core-surface pl-2.5 pr-2 text-[12.5px] font-medium transition-all duration-150 ${
            specFilterCount > 0
              ? 'border-core-border text-core-text shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]'
              : 'border-core-border/95 text-core-text2 hover:border-core-border hover:bg-core-surface2'
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="text-core-text3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
          Specs
          {specFilterCount > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-core-text px-1 text-[10px] font-semibold text-white tabular-nums">
              {specFilterCount}
            </span>
          )}
        </button>

        {advancedOpen && (
          <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-md border border-core-border/85 bg-core-surface p-3 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.12)]">
            <div className="grid grid-cols-2 gap-2.5">
              <SpecInput label="RAM" value={ram} onChange={setRam} placeholder="e.g. 16" />
              <SpecInput label="Storage" value={storage} onChange={setStorage} placeholder="e.g. 512" />
              <SpecInput label="Processor" value={cpu} onChange={setCpu} placeholder="e.g. i7" />
              <SpecInput label="GPU" value={gpu} onChange={setGpu} placeholder="e.g. RTX" />
            </div>
            {specFilterCount > 0 && (
              <div className="mt-2.5 flex justify-end">
                <button
                  onClick={() => {
                    setRam('');
                    setStorage('');
                    setCpu('');
                    setGpu('');
                  }}
                  className="text-[11.5px] font-medium text-core-text3 transition-colors hover:text-core-text"
                >
                  Clear specs
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {hasAnyFilter && (
        <button
          onClick={clearAll}
          className="ml-1 inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-core-text3 transition-colors hover:bg-core-surface2 hover:text-core-text"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18 M6 6l12 12" />
          </svg>
          Clear
        </button>
      )}
    </div>
  );
}

function SpecInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.06em] text-core-text3">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 w-full rounded border border-core-border bg-core-surface px-2 text-[12px] text-core-text placeholder:text-core-text3 focus:border-zinc-400 focus:outline-none"
      />
    </label>
  );
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value && value.trim()) {
    params.set(key, value.trim());
  } else {
    params.delete(key);
  }
}
