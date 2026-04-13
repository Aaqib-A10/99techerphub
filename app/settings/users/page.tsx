'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHero from '@/app/components/PageHero';
import Modal from '@/components/Modal';
import TablePagination from '@/app/components/TablePagination';
import BulkActionBar from '@/app/components/BulkActionBar';

interface UserAccount {
  id: number;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  employeeId: number | null;
  createdAt: string;
  employee: {
    id: number;
    firstName: string;
    lastName: string;
    empCode: string;
    designation: string;
  } | null;
}

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  empCode: string;
}

const ROLES = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE', 'ACCOUNTANT'];

const roleBadgeColors: Record<string, string> = {
  ADMIN: 'badge-red',
  HR: 'badge-green',
  MANAGER: 'badge-blue',
  EMPLOYEE: 'badge-gray',
  ACCOUNTANT: 'badge-purple',
};

export default function UserAccountsPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    role: 'EMPLOYEE',
    employeeId: '',
  });

  // Edit user modal
  const [showEdit, setShowEdit] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editUser, setEditUser] = useState<UserAccount | null>(null);
  const [editForm, setEditForm] = useState({
    role: '',
    password: '',
    employeeId: '',
  });

  // Filter
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchEmployees();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading users');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees?limit=500');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.employees || [];
        setEmployees(list);
      }
    } catch {
      // Non-critical
    }
  };

  const handleCreate = async () => {
    if (!createForm.email || !createForm.password) {
      setError('Email and password are required');
      return;
    }
    setCreateLoading(true);
    setError('');

    try {
      const payload: any = {
        email: createForm.email,
        password: createForm.password,
        role: createForm.role,
      };
      if (createForm.employeeId) {
        payload.employeeId = parseInt(createForm.employeeId);
      }

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create user');
      }

      const newUser = await res.json();
      setUsers([newUser, ...users]);
      setCreateForm({ email: '', password: '', role: 'EMPLOYEE', employeeId: '' });
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating user');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setEditLoading(true);
    setError('');

    try {
      const payload: any = {};
      if (editForm.role && editForm.role !== editUser.role) {
        payload.role = editForm.role;
      }
      if (editForm.password) {
        payload.password = editForm.password;
      }
      if (editForm.employeeId !== String(editUser.employeeId || '')) {
        payload.employeeId = editForm.employeeId ? parseInt(editForm.employeeId) : null;
      }

      if (Object.keys(payload).length === 0) {
        setShowEdit(false);
        return;
      }

      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update user');
      }

      const updated = await res.json();
      setUsers(users.map((u) => (u.id === updated.id ? updated : u)));
      setShowEdit(false);
      setEditUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating user');
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleActive = async (user: UserAccount) => {
    const action = user.isActive ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${action} ${user.email}?`)) return;

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action} user`);
      }

      const updated = await res.json();
      setUsers(users.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : `Error ${action}ing user`);
    }
  };

  const openEdit = (user: UserAccount) => {
    setEditUser(user);
    setEditForm({
      role: user.role,
      password: '',
      employeeId: String(user.employeeId || ''),
    });
    setShowEdit(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get employees not already linked to a user (for dropdowns)
  const linkedEmployeeIds = new Set(users.map((u) => u.employeeId).filter(Boolean));
  const availableEmployees = employees.filter(
    (e) => !linkedEmployeeIds.has(e.id) || (editUser && editUser.employeeId === e.id)
  );

  const filteredUsers =
    roleFilter === 'ALL' ? users : users.filter((u) => u.role === roleFilter);

  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Bulk selection helpers
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pageIds = paginatedUsers.map((e) => e.id);
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
    setSelectedIds(new Set(filteredUsers.map((e) => e.id)));
  };

  const handleBulkAction = async (actionKey: string) => {
    const ids = Array.from(selectedIds);
    setBulkLoading(actionKey);
    try {
      if (actionKey === 'export') {
        // Build CSV from selected users
        const selected = filteredUsers.filter((e) => selectedIds.has(e.id));
        const header = ['Email', 'Role', 'Linked Employee', 'Last Login', 'Status'];
        const rows = selected.map((e) => [
          e.email, e.role,
          e.employee ? `${e.employee.firstName} ${e.employee.lastName} (${e.employee.empCode})` : 'Not linked',
          e.lastLoginAt ? new Date(e.lastLoginAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          }) : 'Never',
          e.isActive ? 'Active' : 'Inactive',
        ]);
        const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (actionKey === 'deactivate') {
        for (const id of ids) {
          await fetch(`/api/users/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: false }),
          });
        }
        router.refresh();
      } else if (actionKey === 'activate') {
        for (const id of ids) {
          await fetch(`/api/users/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: true }),
          });
        }
        router.refresh();
      } else if (actionKey === 'delete') {
        for (const id of ids) {
          await fetch(`/api/users/${id}`, { method: 'DELETE' });
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
    { key: 'deactivate', label: 'Deactivate', variant: 'warning' as const, confirm: 'Deactivate {count} user(s)?' },
    { key: 'activate', label: 'Activate', variant: 'success' as const, confirm: 'Activate {count} user(s)?' },
    { key: 'delete', label: 'Delete', variant: 'danger' as const, confirm: 'Permanently delete {count} user(s)? This cannot be undone.' },
  ];

  return (
    <div>
      <PageHero
        eyebrow="Settings / Access Control"
        title="User Accounts"
        description="Manage login accounts, assign roles, and link employees to their user profiles"
        actions={
          <button onClick={() => setShowCreate(true)} className="btn btn-accent">
            + New User Account
          </button>
        }
      />

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
          <button
            onClick={() => setError('')}
            className="ml-4 text-red-800 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Role Filter Tabs */}
      <div className="tab-bar mb-6 flex-wrap">
        <button
          onClick={() => setRoleFilter('ALL')}
          className={`tab-btn ${roleFilter === 'ALL' ? 'active' : ''}`}
        >
          All ({users.length})
        </button>
        {ROLES.map((role) => (
          <button
            key={role}
            onClick={() => setRoleFilter(role)}
            className={`tab-btn ${roleFilter === role ? 'active' : ''}`}
          >
            {role} ({users.filter((u) => u.role === role).length})
          </button>
        ))}
      </div>

      {/* Users Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="section-heading">
            {roleFilter === 'ALL' ? 'All Accounts' : roleFilter} ({filteredUsers.length})
          </h2>
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
                <th>Email</th>
                <th>Role</th>
                <th>Linked Employee</th>
                <th>Last Login</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    Loading accounts...
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    No user accounts found
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr
                    key={user.id}
                    style={selectedIds.has(user.id) ? { backgroundColor: 'rgba(20, 184, 166, 0.06)' } : undefined}
                  >
                    <td onClick={(e) => e.stopPropagation()} style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(user.id)}
                        onChange={() => toggleSelect(user.id)}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#14B8A6' }}
                      />
                    </td>
                    <td>
                      <div className="font-semibold" style={{ color: '#0B1F3A' }}>
                        {user.email}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#75777E', fontFamily: 'JetBrains Mono, monospace' }}>
                        ID: {user.id}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${roleBadgeColors[user.role] || 'badge-gray'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      {user.employee ? (
                        <div>
                          <div className="font-medium text-sm">
                            {user.employee.firstName} {user.employee.lastName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#75777E', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
                            {user.employee.empCode} — {user.employee.designation}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not linked</span>
                      )}
                    </td>
                    <td className="text-sm" style={{ color: '#44474D' }}>
                      {formatDate(user.lastLoginAt)}
                    </td>
                    <td>
                      <span
                        className={`badge ${user.isActive ? 'badge-green' : 'badge-red'}`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(user)}
                          className="btn btn-sm btn-outline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`btn btn-sm ${
                            user.isActive ? 'btn-outline-danger' : 'btn-outline'
                          }`}
                        >
                          {user.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={currentPage}
          totalItems={filteredUsers.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />

        {/* Bulk Action Bar */}
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalCount={filteredUsers.length}
          allSelected={selectedIds.size === filteredUsers.length}
          onSelectAll={selectAllFiltered}
          onDeselectAll={() => setSelectedIds(new Set())}
          actions={bulkActions}
          onAction={handleBulkAction}
          loading={bulkLoading}
        />
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreate}
        title="Create New User Account"
        onClose={() => {
          setShowCreate(false);
          setCreateForm({ email: '', password: '', role: 'EMPLOYEE', employeeId: '' });
          setError('');
        }}
        onSubmit={handleCreate}
        submitLabel="Create Account"
        submitDisabled={createLoading}
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Email Address *</label>
            <input
              type="email"
              className="form-input"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="user@99technologies.com"
            />
          </div>
          <div>
            <label className="form-label">Password *</label>
            <input
              type="password"
              className="form-input"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="Minimum 6 characters"
            />
          </div>
          <div>
            <label className="form-label">Role *</label>
            <select
              className="form-input"
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: '#75777E' }}>
              Admin: Full access | HR: Employees & onboarding | Manager: Department-level |
              Accountant: Finance & payroll | Employee: Self-service
            </p>
          </div>
          <div>
            <label className="form-label">Link to Employee (Optional)</label>
            <select
              className="form-input"
              value={createForm.employeeId}
              onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value })}
            >
              <option value="">— No employee linked —</option>
              {availableEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.empCode})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEdit}
        title={`Edit Account: ${editUser?.email || ''}`}
        onClose={() => {
          setShowEdit(false);
          setEditUser(null);
          setError('');
        }}
        onSubmit={handleEdit}
        submitLabel="Save Changes"
        submitDisabled={editLoading}
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Role</label>
            <select
              className="form-input"
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Reset Password (leave blank to keep current)</label>
            <input
              type="password"
              className="form-input"
              value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              placeholder="New password (min 6 characters)"
            />
          </div>
          <div>
            <label className="form-label">Link to Employee</label>
            <select
              className="form-input"
              value={editForm.employeeId}
              onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })}
            >
              <option value="">— No employee linked —</option>
              {availableEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.empCode})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
