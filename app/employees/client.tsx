'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ExportButton from '@/components/ExportButton';
import TablePagination from '@/app/components/TablePagination';
import BulkActionBar from '@/app/components/BulkActionBar';

// Three-way employment lifecycle filter for the employees list.
// Kept in URL-param form so dashboard tiles can deep-link e.g. ?status=exited.
type LifecycleView = 'active' | 'exited' | 'all';

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
  // Read initial lifecycle view from ?status= so the dashboard tile can
  // deep-link into the exited sub-list without the user touching filters.
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
    lifecycleView: initialLifecycleView,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  // Keep state in sync if the URL changes while we're on the page.
  useEffect(() => {
    const s = searchParams?.get('status');
    const next: LifecycleView = s === 'exited' ? 'exited' : s === 'all' ? 'all' : 'active';
    setFilters((prev) => (prev.lifecycleView === next ? prev : { ...prev, lifecycleView: next }));
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Filter and search
  const filteredEmployees = useMemo(() => {
    return initialEmployees.filter((emp) => {
      const searchTerm = filters.search.toLowerCase();
      const matchesSearch =
        emp.empCode.toLowerCase().includes(searchTerm) ||
        emp.firstName.toLowerCase().includes(searchTerm) ||
        emp.lastName.toLowerCase().includes(searchTerm) ||
        (emp.email && emp.email.toLowerCase().includes(searchTerm)) ||
        (emp.phone && emp.phone.includes(searchTerm));

      const matchesDept =
        !filters.department || emp.department.id.toString() === filters.department;
      const matchesCompany =
        !filters.company || emp.companies?.some((c) => c.id.toString() === filters.company) || emp.company?.id.toString() === filters.company;
      const matchesStatus = !filters.status || emp.employmentStatus === filters.status;

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

      return (
        matchesSearch && matchesDept && matchesCompany && matchesStatus && matchesLifecycle
      );
    });
  }, [filters, initialEmployees]);

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
        const header = ['Emp Code', 'First Name', 'Last Name', 'Email', 'Department', 'Company', 'Designation', 'Status', 'Joining Date'];
        const rows = selected.map((e) => [
          e.empCode, e.firstName, e.lastName, e.email || '', e.department.name,
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
        <div
          className="stat-card cursor-pointer hover:shadow-md transition"
          onClick={() => {
            setFilters({ ...filters, lifecycleView: 'exited' });
            setCurrentPage(1);
          }}
          title="Click to view recently exited employees"
        >
          <div className="stat-label">Exited (30d)</div>
          <div className="stat-value text-red-500">{stats.exitedLast30 ?? 0}</div>
          <div className="text-[11px] mt-1" style={{ color: '#75777E' }}>Last 30 days</div>
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

      {/* Search and Filter with Export */}
      <div className="card mb-6">
        <div className="card-header flex justify-between items-center">
          <h3 className="section-heading">Filters</h3>
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
        <div className="card-body space-y-4">
          {/* Search Bar */}
          <div>
            <label className="form-label">Search</label>
            <input
              type="text"
              placeholder="Search by name, emp code, email, or phone..."
              value={filters.search}
              onChange={(e) => {
                setFilters({ ...filters, search: e.target.value });
                setCurrentPage(1);
              }}
              className="form-input w-full"
            />
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="form-label">Department</label>
              <select
                value={filters.department}
                onChange={(e) => {
                  setFilters({ ...filters, department: e.target.value });
                  setCurrentPage(1);
                }}
                className="form-select w-full"
              >
                <option value="">All Departments</option>
                {initialDepartments.map((dept) => (
                  <option key={dept.id} value={dept.id.toString()}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Company</label>
              <select
                value={filters.company}
                onChange={(e) => {
                  setFilters({ ...filters, company: e.target.value });
                  setCurrentPage(1);
                }}
                className="form-select w-full"
              >
                <option value="">All Companies</option>
                {initialCompanies.map((comp) => (
                  <option key={comp.id} value={comp.id.toString()}>
                    {comp.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Employment Status</label>
              <select
                value={filters.status}
                onChange={(e) => {
                  setFilters({ ...filters, status: e.target.value });
                  setCurrentPage(1);
                }}
                className="form-select w-full"
              >
                <option value="">All Status</option>
                <option value="PERMANENT">Permanent</option>
                <option value="PROBATION">Probation</option>
                <option value="CONSULTANT">Consultant</option>
              </select>
            </div>

            <div>
              <label className="form-label">Show</label>
              <select
                value={filters.lifecycleView}
                onChange={(e) => {
                  setFilters({ ...filters, lifecycleView: e.target.value as LifecycleView });
                  setCurrentPage(1);
                }}
                className="form-select w-full"
              >
                <option value="active">Active only</option>
                <option value="exited">Exited only</option>
                <option value="all">All (active + exited)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({
                    search: '',
                    department: '',
                    company: '',
                    status: '',
                    lifecycleView: 'active',
                  });
                  setCurrentPage(1);
                }}
                className="btn btn-secondary w-full justify-center"
              >
                Reset
              </button>
            </div>
          </div>
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
                <th>Company</th>
                <th>Designation</th>
                <th>Status</th>
                <th>Joining Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-500">
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
                    <td style={{ whiteSpace: 'nowrap' }}>
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
