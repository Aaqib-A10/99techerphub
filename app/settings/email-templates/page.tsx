'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PageHero from '@/app/components/PageHero';
import TablePagination from '@/app/components/TablePagination';
import BulkActionBar from '@/app/components/BulkActionBar';

interface EmailTemplate {
  id: number;
  templateKey: string;
  name: string;
  category: string;
  subject: string;
  isActive: boolean;
  updatedAt: string;
}

const categoryColors: Record<string, string> = {
  OFFER: 'badge-blue',
  ONBOARDING: 'badge-green',
  EXPENSE: 'badge-orange',
  PAYROLL: 'badge-purple',
  ASSET: 'badge-cyan',
  GENERAL: 'badge-gray',
};

const categories = [
  { key: 'ALL', label: 'All Templates' },
  { key: 'OFFER', label: 'Offer Letters' },
  { key: 'ONBOARDING', label: 'Onboarding' },
  { key: 'EXPENSE', label: 'Expenses' },
  { key: 'PAYROLL', label: 'Payroll' },
  { key: 'ASSET', label: 'Assets' },
  { key: 'GENERAL', label: 'General' },
];

export default function EmailTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<EmailTemplate[]>([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    filterTemplates(activeCategory);
  }, [templates, activeCategory]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/email-templates');
      if (!res.ok) throw new Error('Failed to fetch templates');
      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading templates');
    } finally {
      setLoading(false);
    }
  };

  const filterTemplates = (category: string) => {
    if (category === 'ALL') {
      setFilteredTemplates(templates);
    } else {
      setFilteredTemplates(templates.filter((t) => t.category === category));
    }
  };

  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/email-templates/${id}/toggle`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to toggle status');
      const updated = await res.json();
      setTemplates(templates.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error toggling status');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      setDeleting(id);
      const res = await fetch(`/api/email-templates/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete template');
      setTemplates(templates.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting template');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Bulk selection helpers
  const paginatedSlice = filteredTemplates.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pageIds = paginatedSlice.map((e) => e.id);
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
    setSelectedIds(new Set(filteredTemplates.map((e) => e.id)));
  };

  const handleBulkAction = async (actionKey: string) => {
    const ids = Array.from(selectedIds);
    setBulkLoading(actionKey);
    try {
      if (actionKey === 'export') {
        // Build CSV from selected templates
        const selected = filteredTemplates.filter((e) => selectedIds.has(e.id));
        const header = ['Name', 'Category', 'Subject', 'Updated', 'Status'];
        const rows = selected.map((e) => [
          e.name, e.category, e.subject, formatDate(e.updatedAt),
          e.isActive ? 'Active' : 'Inactive',
        ]);
        const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `email-templates-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (actionKey === 'activate') {
        for (const id of ids) {
          const template = templates.find(t => t.id === id);
          if (template && !template.isActive) {
            await fetch(`/api/email-templates/${id}/toggle`, { method: 'POST' });
          }
        }
        router.refresh();
      } else if (actionKey === 'deactivate') {
        for (const id of ids) {
          const template = templates.find(t => t.id === id);
          if (template && template.isActive) {
            await fetch(`/api/email-templates/${id}/toggle`, { method: 'POST' });
          }
        }
        router.refresh();
      } else if (actionKey === 'delete') {
        for (const id of ids) {
          await fetch(`/api/email-templates/${id}`, { method: 'DELETE' });
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
    { key: 'activate', label: 'Activate', variant: 'success' as const },
    { key: 'deactivate', label: 'Deactivate', variant: 'warning' as const },
    { key: 'delete', label: 'Delete', variant: 'danger' as const, confirm: 'Permanently delete {count} template(s)? This cannot be undone.' },
  ];

  return (
    <div>
      <PageHero
        eyebrow="Settings / Email"
        title="Email Templates"
        description="Manage email templates for offers, onboarding, expenses, payroll, and assets"
        actions={
          <Link href="/settings/email-templates/new" className="btn btn-accent">
            + New Template
          </Link>
        }
      />

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>
      )}

      {/* Category Filters */}
      <div className="tab-bar mb-6 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`tab-btn ${activeCategory === cat.key ? 'active' : ''}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="section-heading">
            {activeCategory === 'ALL'
              ? 'All Templates'
              : categories.find((c) => c.key === activeCategory)?.label}{' '}
            ({filteredTemplates.length})
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
                <th>Name</th>
                <th>Category</th>
                <th>Subject Preview</th>
                <th>Updated</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    Loading templates...
                  </td>
                </tr>
              ) : filteredTemplates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    No templates found
                  </td>
                </tr>
              ) : (
                paginatedSlice.map((template) => (
                  <tr
                    key={template.id}
                    style={selectedIds.has(template.id) ? { backgroundColor: 'rgba(20, 184, 166, 0.06)' } : undefined}
                  >
                    <td onClick={(e) => e.stopPropagation()} style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(template.id)}
                        onChange={() => toggleSelect(template.id)}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#14B8A6' }}
                      />
                    </td>
                    <td className="font-semibold">{template.name}</td>
                    <td>
                      <span
                        className={`badge ${
                          categoryColors[template.category] || 'badge-gray'
                        }`}
                      >
                        {template.category}
                      </span>
                    </td>
                    <td className="text-sm text-gray-600 max-w-xs truncate">
                      {template.subject}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', color: '#6B7280' }}>
                      {formatDate(template.updatedAt)}
                    </td>
                    <td>
                      <button
                        onClick={() =>
                          handleToggleActive(template.id, template.isActive)
                        }
                        className={`badge ${
                          template.isActive ? 'badge-green' : 'badge-red'
                        } cursor-pointer hover:opacity-80`}
                      >
                        {template.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Link
                          href={`/settings/email-templates/${template.id}`}
                          className="btn btn-sm btn-outline"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() =>
                            handleDelete(template.id, template.name)
                          }
                          disabled={deleting === template.id}
                          className="btn btn-sm btn-outline-danger disabled:opacity-50"
                        >
                          {deleting === template.id ? 'Deleting...' : 'Delete'}
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
          totalItems={filteredTemplates.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />

        {/* Bulk Action Bar */}
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalCount={filteredTemplates.length}
          allSelected={selectedIds.size === filteredTemplates.length}
          onSelectAll={selectAllFiltered}
          onDeselectAll={() => setSelectedIds(new Set())}
          actions={bulkActions}
          onAction={handleBulkAction}
          loading={bulkLoading}
        />
      </div>
    </div>
  );
}
