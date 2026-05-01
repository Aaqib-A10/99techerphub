'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ExportButton from '@/components/ExportButton';
import TablePagination from '@/app/components/TablePagination';
import BulkActionBar from '@/app/components/BulkActionBar';
import DateFilter from '@/app/components/DateFilter';
import FilterChip from '@/app/components/FilterChip';
import { KpiTile, Card, Badge, Tag, Avi, Btn } from '@/app/components/design';

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

  // Hydrate company / department from URL too so the dashboard's KPI tiles
  // (and any external link) carry their filter through to this list.
  const [filters, setFilters] = useState<FilterParams>({
    search: '',
    department: searchParams?.get('department') ?? '',
    company: searchParams?.get('company') ?? '',
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
      } else if (actionKey === 'deactivate' || actionKey === 'activate' || actionKey === 'delete') {
        // Track each request so a partial failure (e.g. FK constraint on a
        // single employee) doesn't get hidden by a blanket "success".
        const failures: { id: number; reason: string }[] = [];
        const succeededIds = new Set<number>();

        for (const id of ids) {
          let res: Response;
          try {
            if (actionKey === 'delete') {
              res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
            } else {
              const body =
                actionKey === 'deactivate'
                  ? { isActive: false, lifecycleStage: 'EXITED' }
                  : { isActive: true, lifecycleStage: 'ACTIVE' };
              res = await fetch(`/api/employees/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
            }
          } catch (e: any) {
            failures.push({ id, reason: e?.message ?? 'Network error' });
            continue;
          }

          if (res.ok) {
            succeededIds.add(id);
          } else {
            const reason = await res
              .json()
              .then((j) => j.error || `HTTP ${res.status}`)
              .catch(() => `HTTP ${res.status}`);
            failures.push({ id, reason });
          }
        }

        router.refresh();

        // Keep failed rows selected so the user can retry without re-checking them.
        setSelectedIds(new Set(ids.filter((id) => !succeededIds.has(id))));

        if (failures.length > 0) {
          const verb =
            actionKey === 'delete'
              ? 'delete'
              : actionKey === 'deactivate'
              ? 'deactivate'
              : 'activate';
          const summary = `${verb}d ${succeededIds.size} of ${ids.length}. ${failures.length} failed:\n\n${failures
            .map((f) => `• #${f.id}: ${f.reason}`)
            .slice(0, 8)
            .join('\n')}${failures.length > 8 ? `\n… and ${failures.length - 8} more` : ''}`;
          alert(summary);
        }
        return;
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

  // KPI tiles — clickable, deep-link into the relevant filter view.
  const totalActive = filters.lifecycleView === 'all' && !filters.status;
  const activeOnly = filters.lifecycleView === 'active' && !filters.status;
  const exitedOnly = filters.lifecycleView === 'exited';
  const probationOnly = filters.status === 'PROBATION';

  const kpiTileWrapper = (active: boolean, onClick: () => void, child: React.ReactNode) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left transition focus:outline-none ${
        active
          ? 'rounded-2xl ring-2 ring-core-text/15 ring-offset-2 ring-offset-core-bg'
          : 'hover:opacity-90'
      }`}
    >
      {child}
    </button>
  );

  return (
    <div>
      {/* KPI strip — 5 tinted Apple Wallet tiles per design */}
      <div className="mb-[18px] grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpiTileWrapper(totalActive, () => { setFilters({ ...filters, lifecycleView: 'all', status: '' }); setCurrentPage(1); },
          <KpiTile tone="green" label="Total Employees" value={stats.total} meta="All time hired" />)}
        {kpiTileWrapper(activeOnly, () => { setFilters({ ...filters, lifecycleView: 'active', status: '' }); setCurrentPage(1); },
          <KpiTile tone="blue" label="Active" value={stats.active} />)}
        {kpiTileWrapper(exitedOnly, () => { setFilters({ ...filters, lifecycleView: 'exited', status: '' }); setCurrentPage(1); },
          <KpiTile tone="rose" label="Exited" value={stats.exited ?? 0} />)}
        {kpiTileWrapper(probationOnly, () => { setFilters({ ...filters, lifecycleView: 'active', status: 'PROBATION' }); setCurrentPage(1); },
          <KpiTile tone="amber" label="On Probation" value={stats.onProbation} />)}
        <KpiTile tone="violet" label="New This Month" value={stats.newThisMonth} />
      </div>

      {/* Compact toolbar — search + chip filters + export */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="group relative flex h-8 min-w-[220px] flex-1 items-center rounded-md border border-core-border/95 bg-core-surface pl-2.5 pr-2 transition-all duration-150 hover:border-core-border focus-within:border-zinc-400 focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.04)] sm:max-w-[280px]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="flex-shrink-0 text-core-text3">
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
            className="ml-2 flex-1 bg-transparent text-[12.5px] text-core-text placeholder:text-core-text3 focus:outline-none"
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
            className="ml-1 inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-core-text3 transition-colors hover:bg-core-surface2 hover:text-core-text"
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
      <Card
        title="All Employees"
        subtitle={`Showing ${paginatedEmployees.length} of ${filteredEmployees.length} records`}
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-core-surface2">
                <th className="border-b border-core-border px-[14px] py-[10px] text-left" style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={togglePageSelect}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#1F2320' }}
                  />
                </th>
                {['Emp Code', 'Name', 'Department', 'Team', 'Bill To', 'Designation', 'Status', 'Joining Date', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="border-b border-core-border px-[14px] py-[10px] text-left text-[10px] font-bold uppercase text-core-text3"
                    style={{ letterSpacing: '0.08em' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-[14px] py-12 text-center text-core-text3">
                    {filteredEmployees.length === 0
                      ? 'No employees found. Try adjusting your filters.'
                      : 'No employees on this page.'}
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((emp, idx) => {
                  const isLast = idx === paginatedEmployees.length - 1;
                  const isSelected = selectedIds.has(emp.id);
                  const initials =
                    `${emp.firstName?.[0] ?? ''}${emp.lastName?.[0] ?? ''}`.toUpperCase() || '?';
                  const team = getTeam(emp.empCode, emp.designation);
                  const statusTone: 'green' | 'amber' | 'blue' | 'rose' = !emp.isActive
                    ? 'rose'
                    : emp.employmentStatus === 'PROBATION'
                    ? 'amber'
                    : emp.employmentStatus === 'CONSULTANT'
                    ? 'blue'
                    : 'green';
                  const statusLabel = !emp.isActive ? 'EXITED' : emp.employmentStatus;
                  return (
                    <tr
                      key={emp.id}
                      onClick={() => handleRowClick(emp.id)}
                      className="cursor-pointer transition-colors hover:bg-core-surface2"
                      style={{
                        height: 54,
                        borderBottom: isLast ? 'none' : '1px solid #E5E8DD',
                        ...(isSelected ? { backgroundColor: 'rgba(143, 191, 63, 0.06)' } : {}),
                      }}
                    >
                      <td onClick={(e) => e.stopPropagation()} className="px-[14px]" style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(emp.id)}
                          style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#1F2320' }}
                        />
                      </td>
                      <td className="whitespace-nowrap px-[14px] font-mono text-[12px] font-semibold text-core-text">
                        {emp.empCode}
                      </td>
                      <td className="px-[14px]">
                        <div className="flex items-center gap-[10px]">
                          <Avi seed={emp.empCode} initials={initials} size={28} />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-core-text">
                              {emp.firstName} {emp.lastName}
                            </div>
                            {emp.email && (
                              <div className="mt-[1px] truncate text-[10.5px] text-core-text3">
                                {emp.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-[14px] text-core-text2">{emp.department.name}</td>
                      <td className="px-[14px]">
                        {team ? <Tag>{team}</Tag> : <span className="text-core-text3">—</span>}
                      </td>
                      <td className="px-[14px]">
                        {emp.companies && emp.companies.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {emp.companies.map((c) => (
                              <Tag key={c.id}>{c.code || c.name}</Tag>
                            ))}
                          </div>
                        ) : (
                          <span className="text-core-text3">—</span>
                        )}
                      </td>
                      <td className="px-[14px] text-core-text2">{emp.designation}</td>
                      <td className="px-[14px]">
                        <Badge tone={statusTone}>{statusLabel}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-[14px] text-core-text2 tabular-nums">
                        {new Date(emp.dateOfJoining).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-[14px]" onClick={(e) => e.stopPropagation()}>
                        <Btn as="a" href={`/employees/${emp.id}`} tone="ghost">
                          View Details
                        </Btn>
                      </td>
                    </tr>
                  );
                })
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
      </Card>

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
