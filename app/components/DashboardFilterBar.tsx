'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import DateFilter from './DateFilter';

export type CompanyOption = { id: number; name: string; code: string };
export type DepartmentOption = { id: number; name: string };

interface DashboardFilterBarProps {
  companies: CompanyOption[];
  departments: DepartmentOption[];
  selectedCompany: string;
  selectedDepartment: string;
}

export default function DashboardFilterBar({
  companies,
  departments,
  selectedCompany,
  selectedDepartment,
}: DashboardFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const buildUrl = (c: string, d: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (c !== 'all') { params.set('company', c); } else { params.delete('company'); }
    if (d !== 'all') { params.set('department', d); } else { params.delete('department'); }
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  };

  const companyLabel =
    selectedCompany === 'all'
      ? 'All Companies'
      : companies.find((c) => String(c.id) === selectedCompany)?.name || 'All Companies';

  const departmentLabel =
    selectedDepartment === 'all'
      ? 'All Departments'
      : departments.find((d) => String(d.id) === selectedDepartment)?.name || 'All Departments';

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Company dropdown */}
      <div className="relative" ref={companyRef}>
        <button
          onClick={() => { setCompanyOpen((v) => !v); setDeptOpen(false); }}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            selectedCompany !== 'all'
              ? 'border-core-border bg-core-greenSoft text-core-greenFg'
              : 'border-core-border bg-core-surface text-core-text2 hover:border-gray-400'
          }`}
        >
          {companyLabel}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {companyOpen && (
          <div className="absolute top-full mt-1 left-0 bg-core-surface border border-core-border rounded-lg shadow-lg z-30 min-w-48 overflow-hidden max-h-80 overflow-y-auto">
            <button
              onClick={() => { router.push(buildUrl('all', selectedDepartment)); setCompanyOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                selectedCompany === 'all' ? 'bg-core-greenSoft text-core-greenFg font-semibold' : 'text-core-text2 hover:bg-core-surface2'
              }`}
            >
              All Companies
            </button>
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => { router.push(buildUrl(String(c.id), selectedDepartment)); setCompanyOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  selectedCompany === String(c.id) ? 'bg-core-greenSoft text-core-greenFg font-semibold' : 'text-core-text2 hover:bg-core-surface2'
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
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            selectedDepartment !== 'all'
              ? 'border-indigo-300 bg-core-blueSoft text-core-blueFg'
              : 'border-core-border bg-core-surface text-core-text2 hover:border-gray-400'
          }`}
        >
          {departmentLabel}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {deptOpen && (
          <div className="absolute top-full mt-1 left-0 bg-core-surface border border-core-border rounded-lg shadow-lg z-30 min-w-48 overflow-hidden max-h-80 overflow-y-auto">
            <button
              onClick={() => { router.push(buildUrl(selectedCompany, 'all')); setDeptOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                selectedDepartment === 'all' ? 'bg-core-blueSoft text-core-blueFg font-semibold' : 'text-core-text2 hover:bg-core-surface2'
              }`}
            >
              All Departments
            </button>
            {departments.map((d) => (
              <button
                key={d.id}
                onClick={() => { router.push(buildUrl(selectedCompany, String(d.id))); setDeptOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  selectedDepartment === String(d.id) ? 'bg-core-blueSoft text-core-blueFg font-semibold' : 'text-core-text2 hover:bg-core-surface2'
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date filter */}
      <DateFilter />
    </div>
  );
}
