'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const COMPANIES = [
  { id: 'all', displayName: 'All' },
  { id: 'mnc', displayName: 'MNC' },
  { id: 'sj', displayName: 'SJ' },
  { id: 'pcmart', displayName: 'PCMART' },
  { id: 'rti', displayName: 'RTI' },
  { id: 'lri', displayName: 'LRI' },
  { id: 'green-loop', displayName: 'Green Loop' },
];

const DATE_RANGES = [
  { id: 'thisMonth', label: 'This Month' },
  { id: 'last30', label: 'Last 30 Days' },
  { id: 'last90', label: 'Last 90 Days' },
  { id: 'thisYear', label: 'This Year' },
  { id: 'all', label: 'All Time' },
];

const LOCATIONS = [
  { id: 'all', label: 'All Locations' },
  { id: 'eagan', label: 'Eagan Office' },
  { id: 'dubai', label: 'Dubai Office' },
  { id: 'islamabad-f3', label: 'Islamabad HQ · F3' },
  { id: 'islamabad-f4', label: 'Islamabad HQ · F4' },
  { id: 'islamabad-f5', label: 'Islamabad HQ · F5' },
];

interface DashboardFiltersProps {
  selectedCompany: string;
  selectedDateRange: string;
  selectedLocation: string;
}

export default function DashboardFilters({
  selectedCompany,
  selectedDateRange,
  selectedLocation,
}: DashboardFiltersProps) {
  const router = useRouter();
  const [dateOpen, setDateOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);
  const locRef = useRef<HTMLDivElement>(null);

  // Click-outside handler to close dropdowns
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dateRef.current && !dateRef.current.contains(e.target as Node))
        setDateOpen(false);
      if (locRef.current && !locRef.current.contains(e.target as Node))
        setLocOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const buildQueryString = (
    company: string,
    dateRange: string,
    location: string
  ) => {
    const params = new URLSearchParams();
    if (company !== 'all') params.append('company', company);
    if (dateRange !== 'all') params.append('dateRange', dateRange);
    if (location !== 'all') params.append('location', location);
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  };

  const go = (c: string, d: string, l: string) =>
    router.push(buildQueryString(c, d, l));

  const getDateLabel = () =>
    DATE_RANGES.find((d) => d.id === selectedDateRange)?.label || 'All Time';
  const getLocLabel = () =>
    LOCATIONS.find((l) => l.id === selectedLocation)?.label || 'All Locations';

  const hasAnyFilter =
    selectedCompany !== 'all' ||
    selectedDateRange !== 'all' ||
    selectedLocation !== 'all';

  return (
    <div className="space-y-3">
      {/* Company pill row — compact, single line */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-core-text3 mr-1">
          Company
        </span>
        {COMPANIES.map((company) => {
          const isActive = selectedCompany === company.id;
          return (
            <button
              key={company.id}
              onClick={() => go(company.id, selectedDateRange, selectedLocation)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-core-text text-white shadow-sm ring-1 ring-core-text/30'
                  : 'bg-core-surface text-core-text2 border border-core-border hover:border-core-text/40 hover:text-core-text2'
              }`}
            >
              {company.displayName}
            </button>
          );
        })}
      </div>

      {/* Date + Location toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative" ref={dateRef}>
          <button
            onClick={() => {
              setDateOpen((v) => !v);
              setLocOpen(false);
            }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              selectedDateRange !== 'all'
                ? 'border-core-border bg-core-blueSoft text-core-blueFg'
                : 'border-core-border bg-core-surface text-core-text2 hover:border-core-border'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {getDateLabel()}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dateOpen && (
            <div className="absolute top-full mt-1 left-0 bg-core-surface border border-core-border rounded-md shadow-lg z-30 min-w-48 overflow-hidden">
              {DATE_RANGES.map((dr) => (
                <button
                  key={dr.id}
                  onClick={() => {
                    go(selectedCompany, dr.id, selectedLocation);
                    setDateOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    selectedDateRange === dr.id
                      ? 'bg-core-blueSoft text-core-blueFg font-semibold'
                      : 'text-core-text2 hover:bg-core-surface2'
                  }`}
                >
                  {dr.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={locRef}>
          <button
            onClick={() => {
              setLocOpen((v) => !v);
              setDateOpen(false);
            }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              selectedLocation !== 'all'
                ? 'border-core-border bg-core-violetSoft text-core-violetFg'
                : 'border-core-border bg-core-surface text-core-text2 hover:border-core-border'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {getLocLabel()}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {locOpen && (
            <div className="absolute top-full mt-1 left-0 bg-core-surface border border-core-border rounded-md shadow-lg z-30 min-w-56 overflow-hidden">
              {LOCATIONS.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => {
                    go(selectedCompany, selectedDateRange, loc.id);
                    setLocOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    selectedLocation === loc.id
                      ? 'bg-core-violetSoft text-core-violetFg font-semibold'
                      : 'text-core-text2 hover:bg-core-surface2'
                  }`}
                >
                  {loc.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {hasAnyFilter && (
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-core-text3 hover:text-core-text2 hover:bg-core-surface2 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
