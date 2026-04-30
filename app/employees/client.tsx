'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ExportButton from '@/components/ExportButton';
import TablePagination from '@/app/components/TablePagination';
import BulkActionBar from '@/app/components/BulkActionBar';
import DateFilter from '@/app/components/DateFilter';
import FilterChip from '@/app/components/FilterChip';

// Three-way employment lifecycle filter for the employees list.
// Kept in URL-param form so dashboard tiles can deep-link e.g. ?status=exited.
type LifecycleView = 'active' | 'exited' | 'all';

// Auto-generate Team from emp code prefix and designation
export function getTeam(empCode: string, designation: string): string {
  const prefix = empCode.split('-')[0]?.toUpperCase();
  const desig = (designation || '').toLowerCase();

  if (prefix === 'DR') return 'Decom-Robotics';
  if (prefix === 'EC' || desig.includes('e commerce')) return 'E commerce';
  if (prefix === 'CSR' || desig.includes('customer support')) return 'Customer Support';
  if (prefix === 'DEV' && desig.includes('ui') && desig.includes('ux')) return 'UI / UX';
  if (prefix === 'DEV') return 'Dev';
  if (prefix === 'DM') return 'Digital Marketing';
  if (prefix === 'UT') return 'UT';
  return '';
}

// Old localStorage key — kept here only so the one-time cleanup useEffect
// below can purge stale entries from existing users' browsers. Filters are
// no longer persisted client-side; URL params + initial defaults are the
// single source of truth (avoids "ghost filters" coming back after refresh
// or after navigating away and returning).
const LEGACY_STORAGE_KEY = 'emp_table_filters';

interface Employee {
  id: number;
  empCode: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  department: { id: number; name: string };
  company?: { id: number; name: string };
  companies: { id: number; code: string; name: string }[];
  designation: string;
  employmentStatus: string;
  isActive: boolean;
  lifecycleStage: string;
  dateOfJoining: Date;
  assetAssignments: any[];
}

interface FilterParams {
  search: string;
  department: string;
  company: string;
  status: string;
  team: string;
  lifecycleView: LifecycleView;
}

export default function EmployeeListClient({
  initialEmployees = [],
  initialCompanies = [],
  initialDepartments = [],
  stats = { total: 0, active: 0, exited: 0, exitedLast30: 0, onProbation: 0, newThisMonth: 0 },
}: {
  initialEmployees?: Employee[];
  initialCompanies?: any[];
  initialDepartments?: any[];
  stats?: any;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initial lifecycle view comes from ?status= so dashboard tiles can
  // deep-link to e.g. the exited sub-list. No localStorage fallback — the
  // page should open in a clean state every time.
  const initialLifecycleView: LifecycleView = (() => {
    const s = searchParams?.get('status');
    if (s === 'exited') return 'exited';
    if (s === 'all') return 'all';
    return 'active';
  })();

  const [filters, setFilters] = useState<FilterParams>({
    search: '',
    department: '',
    company: '',
    status: '',
    team: '',
    lifecycleView: initialLifecycleView,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  // One-time cleanup: drop stale localStorage from prior versions that
  // persisted filters across sessions. Safe to remove this useEffect after
  // a few weeks — most active users will have visited the page by then.
  useEffect(() => {
    try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch {}
  }, []);

  // Keep state in sync if the URL changes while we're on the page.
  useEffect(() => {
    const s = searchParams?.get('status');
    if (!s) return;
    const next: LifecycleView = s === 'exited' ? 'exited' : s === 'all' ? 'all' : 'active';
    setFilters((prev) => (prev.lifecycleView === next ? prev : { ...prev, lifecycleView: next }));
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Date filter from URL params
  const dateFrom = searchParams?.get('from') || '';
  const dateTo = searchParams?.get('to') || '';

  // Filter and search
  const filteredEmployees = useMemo(() => {
    return initialEmployees.filter((emp) => {
      const searchTerm = filters.search.toLowerCase();
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const matchesSearch =
        emp.empCode.toLowerCase().includes(searchTerm) ||
        fullName.includes(searchTerm) ||
        emp.firstName.toLowerCase().includes(searchTerm) ||
        emp.lastName.toLowerCase().includes(searchTerm) ||
        (emp.email && emp.email.toLowerCase().includes(searchTerm)) ||
        (emp.phone && emp.phone.includes(searchTerm));

      const matchesDept =
        !filters.department || emp.department.id.toString() === filters.department;
      const matchesCompany =
        !filters.company || emp.companies?.some((c) => c.id.toString() === filters.company) || emp.company?.id.toString() === filters.company;
      const matchesStatus = !filters.status || emp.employmentStatus === filters.status;

      const empTeam = getTeam(emp.empCode, emp.designation);
      const matchesTeam = !filters.team || empTeam === filters.team;

      const isExited =
        !emp.isActive ||
        emp.lifecycleStage === 'EXITED' ||
        emp.lifecycleStage === 'EXIT_INITIATED';
      const matchesLifecycle =
        filters.lifecycleView === 'all'
          ? true
          : filters.lifecycleView === 'exited'
            ? isExited
            : !isExited;

      // Date range filter on dateOfJoining
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const joinDate = new Date(emp.dateOfJoining);
        if (dateFrom && joinDate < new Date(dateFrom)) matchesDate = false;
        if (dateTo && joinDate > new Date(dateTo + 'T23:59:59')) matchesDate = false;
      }

      return (
        matchesSearch && matchesDept && matchesCompany && matchesStatus && matchesTeam && matchesLifecycle && matchesDate
      );
    });
  }, [filters, initialEmployees, dateFrom, dateTo]);

  // Pagination
  const paginatedEmployees = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredEmployees, currentPage]);

  const handleRowClick = (empId: number) => {
    router.push(`/employees/${empId}`);
  };

  // Bulk selection helpers
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pageIds = paginatedEmployees.map((e) => e.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const togglePageSelect = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };
  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredEmployees.map((e) => e.id)));
  };

  const handleBulkAction = async (actionKey: string) => {
    const ids = Array.from(selectedIds);
    setBulkLoading(actionKey);
    try {
      if (actionKey === 'export') {
        // Build CSV from selected employees
        const selected = filteredEmployees.filter((e) => selectedIds.has(e.id));
        const header = ['Emp Code', 'First Name', 'Last Name', 'Email', 'Department', 'Team', 'Company', 'Designation', 'Status', 'Joining Date'];
        const rows = selected.map((e) => [
          e.empCode, e.firstName, e.lastName, e.email || '', e.department.name, getTeam(e.empCode, e.designation),
          e.companies?.map((c) => c.code || c.name).join(' / ') || e.company?.name || '', e.designation, e.isActive ? e.employmentStatus : 'EXITED',
          new Date(e.dateOfJoining).toLocaleDateString(),
        ]);
        const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `employees-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (actionKey === 'deactivate') {
        for (const id of ids) {
          await fetch(`/api/employees/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: false, lifecycleStage: 'EXITED' }),
          });
        }
        router.refresh();
      } else if (actionKey === 'activate') {
        for (const id of ids) {
          await fetch(`/api/employees/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: true, lifecycleStage: 'ACTIVE' }),
          });
        }
        router.refresh();
      } else if (actionKey === 'delete') {
        for (const id of ids) {
          await fetch(`/api/employees/${id}`, { method: 'DELETE' });
        }
        router.refresh();
      }
      setSelectedIds(new Set());
    } catch (err) {
      alert('Bulk action failed. Please try again.');
    } finally {
      setBulkLoading(null);
    }
  };

  const bulkActions = [
    { key: 'export', label: 'Export Selected', variant: 'default' as const },
    { key: 'deactivate', label: 'Deactivate', variant: 'warning' as const, confirm: 'Deactivate {count} employee(s)? They will be marked as exited.' },
    { key: 'activate', label: 'Activate', variant: 'success' as const, confirm: 'Reactivate {count} employee(s)?' },
    { key: 'delete', label: 'Delete', variant: 'danger' as const, confirm: 'Permanently delete {count} employee(s)? This cannot be undone.' },
  ];

  return (
    <div>
      {/* Enhanced Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
        <div className="stat-card">
          <div className="stat-label">Total Employees</div>
          <div className="stat-value">{stats.total}</div>
          <div className="text-[11px] mt-1" style={{ color: '#75777E' }}>All time hired</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active</div>
          <div className="stat-value text-green-600">{stats.active}</div>
        </div>
        <div
          className="stat-card cursor-pointer hover:shadow-md transition"
          onClick={() => {
            setFilters({ ...filters, lifecycleView: 'exited' });
            setCurrentPage(1);
          }}
          title="Click to view exited employees"
        >
          <div className="stat-label">Exited</div>
          <div className="stat-value text-slate-600">{stats.exited ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">On Probation</div>
          <div className="stat-value text-blue-600">{stats.onProbation}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">New This Month</div>
          <div className="stat-value text-purple-600">{stats.newThisMonth}</div>
        </div>
      </div>

      {/* Compact toolbar — search + chip filters + export */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="group relative flex h-8 min-w-[220px] flex-1 items-center rounded-md border border-zinc-200/95 bg-white pl-2.5 pr-2 transition-all duration-150 hover:border-zinc-300 focus-within:border-zinc-400 focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.04)] sm:max-w-[280px]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="flex-shrink-0 text-zinc-400">
            <path d="M21 21l-4.35-4.35 M11 19a8 8 0 100-16 8 8 0 000 16z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            type="text"
            placeholder="Search employees…"
            value={filters.search}
            onChange={(e) => {
              setFilters({ ...filters, search: e.target.value });
              setCurrentPage(1);
            }}
            className="ml-2 flex-1 bg-transparent text-[12.5px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </div>

        <FilterChip
          value={filters.department}
          onChange={(v) => {
            setFilters({ ...filters, department: v });
            setCurrentPage(1);
          }}
          options={initialDepartments.map((d) => ({ value: d.id.toString(), label: d.name }))}
          placeholder="All Departments"
        />

        <FilterChip
          value={filters.company}
          onChange={(v) => {
            setFilters({ ...filters, company: v });
            setCurrentPage(1);
          }}
          options={initialCompanies.map((c) => ({ value: c.id.toString(), label: c.name }))}
          placeholder="All Companies"
        />

        <FilterChip
          value={filters.status}
          onChange={(v) => {
            setFilters({ ...filters, status: v });
            setCurrentPage(1);
          }}
          options={[
            { value: 'PERMANENT', label: 'Permanent' },
            { value: 'PROBATION', label: 'Probation' },
            { value: 'CONSULTANT', label: 'Consultant' },
          ]}
          placeholder="All Status"
        />

        <FilterChip
          value={filters.team}
          onChange={(v) => {
            setFilters({ ...filters, team: v });
            setCurrentPage(1);
          }}
          options={[
            { value: 'Dev', label: 'Dev' },
            { value: 'UI / UX', label: 'UI / UX' },
            { value: 'Customer Support', label: 'Customer Support' },
            { value: 'Digital Marketing', label: 'Digital Marketing' },
            { value: 'E commerce', label: 'E commerce' },
            { value: 'Decom-Robotics', label: 'Decom-Robotics' },
            { value: 'UT', label: 'UT' },
          ]}
          placeholder="All Teams"
        />

        <FilterChip
          value={filters.lifecycleView === 'active' ? '' : filters.lifecycleView}
          onChange={(v) => {
            setFilters({ ...filters, lifecycleView: (v || 'active') as LifecycleView });
            setCurrentPage(1);
          }}
          options={[
            { value: 'exited', label: 'Exited only' },
            { value: 'all', label: 'All (active + exited)' },
          ]}
          placeholder="Active only"
        />

        {/* Clear (only when something is set) */}
        {(filters.search ||
          filters.department ||
          filters.company ||
          filters.status ||
          filters.team ||
          filters.lifecycleView !== 'active') && (
          <button
            onClick={() => {
              setFilters({
                search: '',
                department: '',
                company: '',
                status: '',
                team: '',
                lifecycleView: 'active',
              });
              setCurrentPage(1);
            }}
            className="ml-1 inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18 M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}

        {/* Spacer pushes the right group */}
        <div className="ml-auto flex items-center gap-1.5">
          <DateFilter />
          <ExportButton
            module="employees"
            filters={{
              departmentId: filters.department || '',
              companyId: filters.company || '',
              status: filters.status || '',
              activeOnly: filters.lifecycleView === 'active',
            }}
          />
        </div>
      </div>

      {/* Employee Table */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="section-heading">All Employees</h2>
          <span className="text-sm text-gray-500">
            Showing {paginatedEmployees.length} of {filteredEmployees.length} records
          </span>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={togglePageSelect}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#14B8A6' }}
                  />
                </th>
                <th>Emp Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Team</th>
                <th>Bill to</th>
                <th>Designation</th>
                <th>Status</th>
                <th>Joining Date</th>
                <th className="col-sticky-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-500">
                    {filteredEmployees.length === 0
                      ? 'No employees found. Try adjusting your filters.'
                      : 'No employees on this page.'}
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => handleRowClick(emp.id)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    style={selectedIds.has(emp.id) ? { backgroundColor: 'rgba(20, 184, 166, 0.06)' } : undefined}
                  >
                    <td onClick={(e) => e.stopPropagation()} style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(emp.id)}
                        onChange={() => toggleSelect(emp.id)}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#14B8A6' }}
                      />
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', fontWeight: 600, color: '#0B1F3A' }}>
                      {emp.empCode}
                    </td>
                    <td>
                      <div className="font-medium">
                        {emp.firstName} {emp.lastName}
                      </div>
                      {emp.email && <div className="text-xs text-gray-500">{emp.email}</div>}
                    </td>
                    <td>{emp.department.name}</td>
                    <td>
                      {(() => {
                        const team = getTeam(emp.empCode, emp.designation);
                        return team ? (
                          <span style={{
                            display: 'inline-block',
                            backgroundColor: 'rgba(20, 184, 166, 0.08)',
                            color: '#0B1F3A',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 9999,
                            whiteSpace: 'nowrap',
                          }}>
                            {team}
                          </span>
                        ) : <span style={{ color: '#C4C6CE' }}>—</span>;
                      })()}
                    </td>
                    <td>
                      {emp.companies && emp.companies.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {emp.companies.map((c) => (
                            <span
                              key={c.id}
                              style={{
                                display: 'inline-block',
                                backgroundColor: 'rgba(11, 31, 58, 0.08)',
                                color: '#0B1F3A',
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 9999,
                                whiteSpace: 'nowrap',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                              }}
                            >
                              {c.code || c.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#C4C6CE' }}>—</span>
                      )}
                    </td>
                    <td>{emp.designation}</td>
                    <td>
                      {emp.isActive ? (
                        <span
                          className={`badge ${
                            emp.employmentStatus === 'PROBATION' ? 'badge-yellow' :
                            emp.employmentStatus === 'CONSULTANT' ? 'badge-blue' :
                            'badge-green'
                          }`}
                        >
                          {emp.employmentStatus}
                        </span>
                      ) : (
                        <span className="badge badge-red">EXITED</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', color: '#44474D' }}>
                      {new Date(emp.dateOfJoining).toLocaleDateString()}
                    </td>
                    <td className="col-sticky-right" style={{ whiteSpace: 'nowrap' }}>
                      <Link
                        href={`/employees/${emp.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="btn btn-sm btn-outline"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <TablePagination
          currentPage={currentPage}
          totalItems={filteredEmployees.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={filteredEmployees.length}
        allSelected={selectedIds.size === filteredEmployees.length}
        onSelectAll={selectAllFiltered}
        onDeselectAll={() => setSelectedIds(new Set())}
        actions={bulkActions}
        onAction={handleBulkAction}
        loading={bulkLoading}
      />
    </div>
  );
}
