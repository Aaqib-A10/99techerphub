'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';

interface Department {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

interface DepartmentsClientProps {
  initialDepartments: Department[];
  employeeCounts: Record<number, number>;
}

export default function DepartmentsClient({
  initialDepartments,
  employeeCounts,
}: DepartmentsClientProps) {
  const [departments, setDepartments] = useState(initialDepartments);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
  });

  const handleAdd = async () => {
    if (!formData.code || !formData.name) {
      setError('All fields are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed to create department');
      }

      const newDepartment = await res.json();
      setDepartments([newDepartment, ...departments]);
      setFormData({ code: '', name: '' });
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating department');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('Deactivate this department? This action can be undone.')) return;

    try {
      const res = await fetch(`/api/departments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });

      if (!res.ok) throw new Error('Failed to deactivate department');

      setDepartments(
        departments.map((d) => (d.id === id ? { ...d, isActive: false } : d))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deactivating department');
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
          Add Department
        </button>
      </div>

      <Modal
        isOpen={isModalOpen}
        title="Add New Department"
        onClose={() => {
          setIsModalOpen(false);
          setFormData({ code: '', name: '' });
          setError('');
        }}
        onSubmit={handleAdd}
        submitLabel="Create Department"
        submitDisabled={loading}
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Code (e.g. HR, IT, DEV) *</label>
            <input
              type="text"
              className="form-input"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="Department Code"
              maxLength={10}
            />
          </div>
          <div>
            <label className="form-label">Department Name *</label>
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Human Resources"
            />
          </div>
        </div>
      </Modal>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Employees</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-500">
                    No departments found
                  </td>
                </tr>
              ) : (
                departments.map((dept) => (
                  <tr key={dept.id}>
                    <td>
                      <span className="badge badge-blue font-mono">{dept.code}</span>
                    </td>
                    <td className="font-semibold">{dept.name}</td>
                    <td className="text-center">{employeeCounts[dept.id] || 0}</td>
                    <td>
                      <span
                        className={`badge ${
                          dept.isActive ? 'badge-green' : 'badge-red'
                        }`}
                      >
                        {dept.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {dept.isActive && (
                        <button
                          onClick={() => handleDeactivate(dept.id)}
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
