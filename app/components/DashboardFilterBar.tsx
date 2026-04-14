'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export type CompanyOption = { id: number; name: string; code: string };
export type DepartmentOption = { id: number; name: string };

interface DashboardFilterBarProps {
  companies: CompanyOption[];
  departments: DepartmentOption[];
  selectedCompany: string;
  selectedDepartment: string;
  dateFrom: string;
  dateTo: string;
}

export default function DashboardFilterBar({
  companies,
  departments,
  selectedCompany,
  selectedDepartment,
  dateFrom,
  dateTo,
}: DashboardFilterBarProps) {
  const router = useRouter();
  const [companyOpen, setCompanyOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const companyRef = useRef<HTMLDivElement>(null);
  const deptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) setCompanyOpen(false);
      if (deptRef.current && !deptRef.current.contains(e.target as Node)) setDeptOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const buildUrl = (c: string, d: string, from: string, to: string) => {
    const params = new URLSearchParams();
    if (c !== 'all') params.append('company', c);
    if (d !== 'all') params.append('department', d);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  };

  const go = (c: string, d: string, from: string, to: string) =>
    router.push(buildUrl(c, d, from, to));

  const companyLabel =
    selectedCompany === 'all'
      ? 'All Companies'
      : companies.find((c) => String(c.id) === selectedCompany)?.name || 'All Companies';

  const departmentLabel =
    selectedDepartment === 'all'
      ? 'All Departments'
      : departments.find((d) => String(d.id) === selectedDepartment)?.name || 'All Departments';

  const hasAnyFilter =
    selectedCompany !== 'all' ||
    selectedDepartment !== 'all' ||
    dateFrom !== '' ||
    dateTo !== '';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Company dropdown */}
      <div className="relative" ref={companyRef}>
        <button
          onClick={() => { setCompanyOpen((v) => !v); setDeptOpen(false); }}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            selectedCompany !== 'all'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          {companyLabel}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {companyOpen && (
          <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-56 overflow-hidden max-h-80 overflow-y-auto">
            <button
              onClick={() => { go('all', selectedDepartment, dateFrom, dateTo); setCompanyOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                selectedCompany === 'all' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              All Companies
            </button>
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => { go(String(c.id), selectedDepartment, dateFrom, dateTo); setCompanyOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  selectedCompany === String(c.id) ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Department dropdown */}
      <div className="relative" ref={deptRef}>
        <button
          onClick={() => { setDeptOpen((v) => !v); setCompanyOpen(false); }}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            selectedDepartment !== 'all'
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          {departmentLabel}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {deptOpen && (
          <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-56 overflow-hidden max-h-80 overflow-y-auto">
            <button
              onClick={() => { go(selectedCompany, 'all', dateFrom, dateTo); setDeptOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                selectedDepartment === 'all' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              All Departments
            </button>
            {departments.map((d) => (
              <button
                key={d.id}
                onClick={() => { go(selectedCompany, String(d.id), dateFrom, dateTo); setDeptOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  selectedDepartment === String(d.id) ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date From */}
      <div className="flex items-center gap-1">
        <label className="text-xs font-medium text-gray-500">From</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => go(selectedCompany, selectedDepartment, e.target.value, dateTo)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            dateFrom ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700'
          }`}
        />
      </div>

      {/* Date To */}
      <div className="flex items-center gap-1">
        <label className="text-xs font-medium text-gray-500">To</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => go(selectedCompany, selectedDepartment, dateFrom, e.target.value)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            dateTo ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700'
          }`}
        />
      </div>

      {hasAnyFilter && (
        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear
        </button>
      )}
    </div>
  );
}
