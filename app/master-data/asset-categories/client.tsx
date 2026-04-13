'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';

interface AssetCategory {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

interface AssetCategoriesClientProps {
  initialCategories: AssetCategory[];
  assetCounts: Record<number, number>;
}

export default function AssetCategoriesClient({
  initialCategories,
  assetCounts,
}: AssetCategoriesClientProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
  });

  const handleAdd = async () => {
    if (!formData.code || !formData.name) {
      setError('Code and Name are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/asset-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed to create category');
      }

      const newCategory = await res.json();
      setCategories([newCategory, ...categories]);
      setFormData({ code: '', name: '', description: '' });
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating category');
    } finally {
      setLoading(false);
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
        title="Add New Asset Category"
        onClose={() => {
          setIsModalOpen(false);
          setFormData({ code: '', name: '', description: '' });
          setError('');
        }}
        onSubmit={handleAdd}
        submitLabel="Create Category"
        submitDisabled={loading}
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Code (e.g. LAPTOP, PHONE) *</label>
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
              placeholder="e.g. Computers & Laptops"
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
                <th>Assets</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-500">
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
                    <td className="text-center">{assetCounts[category.id] || 0}</td>
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
