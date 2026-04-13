'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';

interface ExpenseCategory {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isGlobal: boolean;
  departmentId: number | null;
  isActive: boolean;
}

interface Department {
  id: number;
  name: string;
}

interface ExpenseCategoriesClientProps {
  initialCategories: ExpenseCategory[];
  expenseCounts: Record<number, number>;
  departments: Department[];
}

export default function ExpenseCategoriesClient({
  initialCategories,
  expenseCounts,
  departments,
}: ExpenseCategoriesClientProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    isGlobal: true,
    departmentId: '',
  });

  const handleAdd = async () => {
    if (!formData.code || !formData.name) {
      setError('Code and Name are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload: any = {
        code: formData.code,
        name: formData.name,
        description: formData.description || null,
        isGlobal: formData.isGlobal,
      };

      if (!formData.isGlobal && formData.departmentId) {
        payload.departmentId = parseInt(formData.departmentId);
      }

      const res = await fetch('/api/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed to create category');
      }

      const newCategory = await res.json();
      setCategories([newCategory, ...categories]);
      setFormData({
        code: '',
        name: '',
        description: '',
        isGlobal: true,
        departmentId: '',
      });
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating category');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('Deactivate this category? This action can be undone.')) return;

    try {
      const res = await fetch(`/api/expense-categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });

      if (!res.ok) throw new Error('Failed to deactivate category');

      setCategories(
        categories.map((c) => (c.id === id ? { ...c, isActive: false } : c))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deactivating category');
    }
  };

  return (
    <div>
      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}

      <div className="flex justify-end mb-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Category
        </button>
      </div>

      <Modal
        isOpen={isModalOpen}
        title="Add New Expense Category"
        onClose={() => {
          setIsModalOpen(false);
          setFormData({
            code: '',
            name: '',
            description: '',
            isGlobal: true,
            departmentId: '',
          });
          setError('');
        }}
        onSubmit={handleAdd}
        submitLabel="Create Category"
        submitDisabled={loading}
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Code (e.g. TRAVEL, MEALS) *</label>
            <input
              type="text"
              className="form-input"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="Category Code"
              maxLength={20}
            />
          </div>
          <div>
            <label className="form-label">Category Name *</label>
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Business Travel"
            />
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of category"
              rows={3}
            />
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isGlobal}
                onChange={(e) => {
                  setFormData({ ...formData, isGlobal: e.target.checked, departmentId: '' });
                }}
              />
              <span className="form-label mb-0">Global (available for all departments)</span>
            </label>
          </div>
          {!formData.isGlobal && (
            <div>
              <label className="form-label">Department</label>
              <select
                className="form-input"
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Modal>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Description</th>
                <th>Scope</th>
                <th>Department</th>
                <th>Expenses</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500">
                    No categories found
                  </td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <span className="badge badge-blue font-mono">{category.code}</span>
                    </td>
                    <td className="font-semibold">{category.name}</td>
                    <td className="text-sm text-gray-600">{category.description || '-'}</td>
                    <td>
                      <span
                        className={`badge ${
                          category.isGlobal ? 'badge-purple' : 'badge-orange'
                        }`}
                      >
                        {category.isGlobal ? 'Global' : 'Dept Specific'}
                      </span>
                    </td>
                    <td className="text-sm text-gray-600">
                      {category.departmentId
                        ? departments.find((d) => d.id === category.departmentId)?.name || '-'
                        : '-'}
                    </td>
                    <td className="text-center">{expenseCounts[category.id] || 0}</td>
                    <td>
                      <span
                        className={`badge ${
                          category.isActive ? 'badge-green' : 'badge-red'
                        }`}
                      >
                        {category.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {category.isActive && (
                        <button
                          onClick={() => handleDeactivate(category.id)}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
