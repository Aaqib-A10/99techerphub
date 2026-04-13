'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import BrandingCard from '../components/BrandingCard';
import PageHero from '@/app/components/PageHero';

type TabType =
  | 'companies'
  | 'departments'
  | 'locations'
  | 'assetCategories'
  | 'expenseCategories';

interface FormFields {
  [key: string]: string | boolean;
}

type Mode = 'add' | 'edit';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('companies');
  const [data, setData] = useState<any>({});
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<Mode>('add');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState<FormFields>({});
  const [showInactive, setShowInactive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: number;
    label: string;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-dismiss toasts after 4s
  useEffect(() => {
    if (!success && !error) return;
    const t = setTimeout(() => {
      setSuccess('');
      setError('');
    }, 4000);
    return () => clearTimeout(t);
  }, [success, error]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/settings');
      const d = await res.json();
      setData(d);
    } catch {}
  };

  const tabs: { key: TabType; label: string; icon: string; singular: string }[] =
    [
      { key: 'companies', label: 'Companies', icon: '🏢', singular: 'Company' },
      {
        key: 'departments',
        label: 'Departments',
        icon: '🏗️',
        singular: 'Department',
      },
      { key: 'locations', label: 'Locations', icon: '📍', singular: 'Location' },
      {
        key: 'assetCategories',
        label: 'Asset Categories',
        icon: '📦',
        singular: 'Asset Category',
      },
      {
        key: 'expenseCategories',
        label: 'Expense Categories',
        icon: '💳',
        singular: 'Expense Category',
      },
    ];

  const formConfig: Record<
    TabType,
    {
      type: string;
      fields: {
        name: string;
        label: string;
        required?: boolean;
        type?: string;
        placeholder?: string;
      }[];
      supportsActive: boolean;
    }
  > = {
    companies: {
      type: 'company',
      supportsActive: true,
      fields: [
        { name: 'code', label: 'Code', required: true, placeholder: 'e.g. MNC' },
        { name: 'name', label: 'Company Name', required: true },
        { name: 'country', label: 'Country', required: true, placeholder: 'US' },
      ],
    },
    departments: {
      type: 'department',
      supportsActive: true,
      fields: [
        { name: 'code', label: 'Code', required: true, placeholder: 'e.g. DEV' },
        { name: 'name', label: 'Department Name', required: true },
      ],
    },
    locations: {
      type: 'location',
      supportsActive: false,
      fields: [
        { name: 'name', label: 'Location Name', required: true },
        { name: 'address', label: 'Address' },
        { name: 'country', label: 'Country', required: true, placeholder: 'PK' },
      ],
    },
    assetCategories: {
      type: 'assetCategory',
      supportsActive: false,
      fields: [
        {
          name: 'code',
          label: 'Code',
          required: true,
          placeholder: 'e.g. LAPTOP',
        },
        { name: 'name', label: 'Category Name', required: true },
        { name: 'description', label: 'Description' },
      ],
    },
    expenseCategories: {
      type: 'expenseCategory',
      supportsActive: true,
      fields: [
        { name: 'code', label: 'Code', required: true, placeholder: 'e.g. HW' },
        { name: 'name', label: 'Category Name', required: true },
        { name: 'description', label: 'Description' },
      ],
    },
  };

  const openAdd = () => {
    setMode('add');
    setEditingId(null);
    setFormData({});
    setShowForm(true);
    setError('');
  };

  const openEdit = (row: any) => {
    setMode('edit');
    setEditingId(row.id);
    const pre: FormFields = {};
    formConfig[activeTab].fields.forEach((f) => {
      pre[f.name] = row[f.name] ?? '';
    });
    if (formConfig[activeTab].supportsActive) pre.isActive = !!row.isActive;
    setFormData(pre);
    setShowForm(true);
    setError('');
    // Scroll form into view
    setTimeout(() => {
      document
        .getElementById('settings-form-card')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormData({});
    setEditingId(null);
    setMode('add');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'add') {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: formConfig[activeTab].type,
            ...formData,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.details || d.error || 'Failed to create');
        }
        setSuccess('Record added successfully');
      } else if (mode === 'edit' && editingId != null) {
        const res = await fetch(
          `/api/settings/${editingId}?type=${formConfig[activeTab].type}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          }
        );
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.details || d.error || 'Failed to update');
        }
        const result = await res.json();
        const n = result?.changedFields?.length ?? 0;
        setSuccess(
          n > 0 ? `Saved ${n} change${n === 1 ? '' : 's'}` : 'No changes detected'
        );
      }
      closeForm();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const doDelete = async (id: number) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(
        `/api/settings/${id}?type=${formConfig[activeTab].type}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.details || d.error || 'Failed to delete');
      }
      const result = await res.json();
      setSuccess(
        result.mode === 'hard'
          ? 'Record permanently removed'
          : 'Record deactivated'
      );
      setConfirmDelete(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      setConfirmDelete(null);
    } finally {
      setLoading(false);
    }
  };

  const doRestore = async (id: number) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(
        `/api/settings/${id}?type=${formConfig[activeTab].type}`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.details || d.error || 'Failed to restore');
      }
      setSuccess('Record restored');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const allItems = (): any[] => data[activeTab] || [];
  const visibleItems = (): any[] => {
    const items = allItems();
    if (!formConfig[activeTab].supportsActive) return items;
    if (showInactive) return items;
    return items.filter((i: any) => i.isActive);
  };

  const currentTab = tabs.find((t) => t.key === activeTab)!;
  const inactiveCount = formConfig[activeTab].supportsActive
    ? allItems().filter((i: any) => !i.isActive).length
    : 0;

  return (
    <div>
      <PageHero
        eyebrow="System / Administration"
        title="Settings & Administration"
        description="Manage lookup tables: companies, departments, locations, and categories"
      />

      {/* Branding */}
      <BrandingCard />

      {/* Tabs */}
      <div className="tab-bar mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              closeForm();
              setError('');
              setSuccess('');
            }}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toasts */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg flex items-start justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            className="text-red-700 hover:text-red-900 font-bold"
          >
            ×
          </button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg flex items-start justify-between gap-3">
          <span>{success}</span>
          <button
            onClick={() => setSuccess('')}
            className="text-green-700 hover:text-green-900 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {formConfig[activeTab].supportsActive && inactiveCount > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded"
              />
              Show inactive ({inactiveCount})
            </label>
          )}
        </div>
        <button onClick={openAdd} className="btn btn-primary btn-sm">
          + Add {currentTab.singular}
        </button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div id="settings-form-card" className="card mb-6">
          <div className="card-header flex justify-between items-center">
            <h2 className="section-heading">
              {mode === 'add' ? 'Add New' : 'Edit'} {currentTab.singular}
              {mode === 'edit' && editingId != null && (
                <span className="ml-2 text-sm text-gray-500">#{editingId}</span>
              )}
            </h2>
            <button
              onClick={closeForm}
              className="text-gray-500 hover:text-gray-700 text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {formConfig[activeTab].fields.map((field) => (
                  <div key={field.name}>
                    <label className="form-label">
                      {field.label} {field.required && '*'}
                    </label>
                    <input
                      value={(formData[field.name] as string) || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, [field.name]: e.target.value })
                      }
                      required={field.required}
                      className="form-input"
                      placeholder={field.placeholder || field.label}
                    />
                  </div>
                ))}
                {mode === 'edit' && formConfig[activeTab].supportsActive && (
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
                      <input
                        type="checkbox"
                        checked={!!formData.isActive}
                        onChange={(e) =>
                          setFormData({ ...formData, isActive: e.target.checked })
                        }
                        className="rounded"
                      />
                      Active
                    </label>
                  </div>
                )}
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? 'Saving...' : mode === 'add' ? 'Save' : 'Update'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="section-heading">
            {currentTab.label} ({visibleItems().length}
            {formConfig[activeTab].supportsActive && !showInactive
              ? ` active`
              : ''}
            )
          </h2>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                {activeTab === 'companies' && (
                  <>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Country</th>
                    <th>Status</th>
                  </>
                )}
                {activeTab === 'departments' && (
                  <>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Status</th>
                  </>
                )}
                {activeTab === 'locations' && (
                  <>
                    <th>Name</th>
                    <th>Address</th>
                    <th>Country</th>
                  </>
                )}
                {activeTab === 'assetCategories' && (
                  <>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Description</th>
                  </>
                )}
                {activeTab === 'expenseCategories' && (
                  <>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Status</th>
                  </>
                )}
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems().length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500">
                    No records found
                  </td>
                </tr>
              ) : (
                visibleItems().map((item: any) => {
                  const isInactive =
                    formConfig[activeTab].supportsActive && !item.isActive;
                  return (
                    <tr
                      key={item.id}
                      className={isInactive ? 'opacity-60' : ''}
                    >
                      <td className="text-sm text-gray-500">#{item.id}</td>
                      {activeTab === 'companies' && (
                        <>
                          <td>
                            <span className="badge badge-blue">{item.code}</span>
                          </td>
                          <td className="font-semibold">{item.name}</td>
                          <td>{item.country}</td>
                          <td>
                            <span
                              className={`badge ${
                                item.isActive ? 'badge-green' : 'badge-red'
                              }`}
                            >
                              {item.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </>
                      )}
                      {activeTab === 'departments' && (
                        <>
                          <td>
                            <span className="badge badge-blue">{item.code}</span>
                          </td>
                          <td className="font-semibold">{item.name}</td>
                          <td>
                            <span
                              className={`badge ${
                                item.isActive ? 'badge-green' : 'badge-red'
                              }`}
                            >
                              {item.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </>
                      )}
                      {activeTab === 'locations' && (
                        <>
                          <td className="font-semibold">{item.name}</td>
                          <td className="text-sm text-gray-600">
                            {item.address || '-'}
                          </td>
                          <td>{item.country}</td>
                        </>
                      )}
                      {activeTab === 'assetCategories' && (
                        <>
                          <td>
                            <span className="badge badge-blue">{item.code}</span>
                          </td>
                          <td className="font-semibold">{item.name}</td>
                          <td className="text-sm text-gray-600">
                            {item.description || '-'}
                          </td>
                        </>
                      )}
                      {activeTab === 'expenseCategories' && (
                        <>
                          <td>
                            <span className="badge badge-blue">{item.code}</span>
                          </td>
                          <td className="font-semibold">{item.name}</td>
                          <td className="text-sm text-gray-600">
                            {item.description || '-'}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                item.isActive ? 'badge-green' : 'badge-red'
                              }`}
                            >
                              {item.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </>
                      )}
                      <td className="text-right whitespace-nowrap">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => openEdit(item)}
                            className="px-3 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                          >
                            ✏️ Edit
                          </button>
                          {isInactive ? (
                            <button
                              onClick={() => doRestore(item.id)}
                              disabled={loading}
                              className="px-3 py-1 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-50"
                            >
                              ♻️ Restore
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                setConfirmDelete({
                                  id: item.id,
                                  label:
                                    item.name ||
                                    item.code ||
                                    `#${item.id}`,
                                })
                              }
                              className="px-3 py-1 text-xs font-semibold rounded-md bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="section-heading mb-2">
              Delete {currentTab.singular}?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete{' '}
              <span className="font-semibold">{confirmDelete.label}</span>?{' '}
              {formConfig[activeTab].supportsActive
                ? 'It will be deactivated and can be restored later.'
                : 'This will permanently remove the record. If it is referenced by other data, the delete will be blocked.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => doDelete(confirmDelete.id)}
                disabled={loading}
                className="btn btn-danger"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Templates Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Communication Management
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/settings/email-templates"
            className="card hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="card-body">
              <div className="flex items-center gap-4">
                <div className="text-4xl">📧</div>
                <div>
                  <h3 className="section-heading">
                    Email Templates
                  </h3>
                  <p className="text-sm text-gray-600">
                    Manage email templates for offers, onboarding, expenses,
                    and payroll
                  </p>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
