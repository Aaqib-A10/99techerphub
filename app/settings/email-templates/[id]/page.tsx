'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { generateSlug, previewTemplate } from '@/lib/email-templates';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';

const categories = [
  { value: 'OFFER', label: 'Offer Letters' },
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'EXPENSE', label: 'Expenses' },
  { value: 'PAYROLL', label: 'Payroll' },
  { value: 'ASSET', label: 'Assets' },
  { value: 'GENERAL', label: 'General' },
];

const categoryMergeFields: Record<string, string[]> = {
  OFFER: [
    'candidate_name',
    'position',
    'department',
    'company_name',
    'start_date',
    'salary',
    'currency',
    'reporting_to',
    'probation_period',
  ],
  ONBOARDING: ['candidate_name', 'onboarding_url', 'expiry_date', 'start_date'],
  EXPENSE: [
    'employee_name',
    'expense_number',
    'amount',
    'approver_name',
    'approval_date',
    'rejection_reason',
  ],
  PAYROLL: [
    'employee_name',
    'period',
    'net_pay',
    'payment_date',
    'base_salary',
    'allowances',
    'gross_salary',
    'deductions',
  ],
  ASSET: [
    'employee_name',
    'asset_tag',
    'asset_category',
    'model',
    'serial_number',
    'assignment_date',
    'assigned_by',
  ],
  GENERAL: [],
};

interface EmailTemplate {
  id: number;
  templateKey: string;
  name: string;
  category: string;
  subject: string;
  bodyHtml: string;
  description?: string;
  mergeFields?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function EditEmailTemplatePage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const id = parseInt(params.id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    fetchTemplate();
  }, [id]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/email-templates/${id}`);
      if (!res.ok) throw new Error('Template not found');
      const data = await res.json();
      setFormData({
        ...data,
        mergeFields: Array.isArray(data.mergeFields) ? data.mergeFields : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value;
    setFormData((prev) =>
      prev
        ? {
            ...prev,
            category,
            mergeFields: categoryMergeFields[category] || [],
          }
        : null
    );
  };

  const toggleMergeField = (field: string) => {
    setFormData((prev) =>
      prev
        ? {
            ...prev,
            mergeFields: prev.mergeFields?.includes(field)
              ? prev.mergeFields.filter((f) => f !== field)
              : [...(prev.mergeFields || []), field],
          }
        : null
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/email-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed to update template');
      }

      router.push('/settings/email-templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!formData) return;
    if (
      !confirm(
        `Are you sure you want to delete "${formData.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      const res = await fetch(`/api/email-templates/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed to delete template');
      }

      router.push('/settings/email-templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting template');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading template...</p>
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Template not found</p>
        <Link href="/settings/email-templates" className="btn btn-primary mt-4">
          Back to Templates
        </Link>
      </div>
    );
  }

  const preview = previewTemplate(
    formData.subject,
    formData.bodyHtml,
    formData.mergeFields && formData.mergeFields.length > 0 ? formData.mergeFields : null
  );

  return (
    <div>
      <PageHero
        eyebrow="Settings / Email"
        title="Edit Email Template"
        description="Update the template details and content"
      />

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                {/* Name */}
                <div className="mb-6">
                  <label className="form-label">Template Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="form-input"
                    required
                  />
                </div>

                {/* Template Key */}
                <div className="mb-6">
                  <label className="form-label">Template Key *</label>
                  <input
                    type="text"
                    value={formData.templateKey}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        templateKey: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
                      })
                    }
                    className="form-input font-mono text-sm"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Unique identifier for this template
                  </p>
                </div>

                {/* Category */}
                <div className="mb-6">
                  <label className="form-label">Category *</label>
                  <select
                    value={formData.category}
                    onChange={handleCategoryChange}
                    className="form-input"
                    required
                  >
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject */}
                <div className="mb-6">
                  <label className="form-label">Subject *</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) =>
                      setFormData({ ...formData, subject: e.target.value })
                    }
                    className="form-input"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use {'{{field_name}}'} syntax for merge fields
                  </p>
                </div>

                {/* Body HTML */}
                <div className="mb-6">
                  <label className="form-label">Email Body (HTML) *</label>
                  <textarea
                    value={formData.bodyHtml}
                    onChange={(e) =>
                      setFormData({ ...formData, bodyHtml: e.target.value })
                    }
                    className="form-input font-mono text-sm"
                    rows={12}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Professional HTML with inline styles recommended
                  </p>
                </div>

                {/* Description */}
                <div className="mb-6">
                  <label className="form-label">Description</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="form-input"
                    rows={3}
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 mb-6">
                  <button type="submit" disabled={saving} className="btn btn-primary">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <Link href="/settings/email-templates" className="btn btn-secondary">
                    Cancel
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="btn btn-outline"
                  >
                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                  </button>
                </div>

                {/* Delete Button */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-bold text-red-600 mb-2">Danger Zone</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    This action cannot be undone. The template will be permanently deleted.
                  </p>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Delete Template'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Sidebar with Merge Fields and Preview */}
        <div className="lg:col-span-1">
          {/* Template Info */}
          <div className="card mb-6">
            <div className="card-header">
              <h3 className="section-heading">Template Info</h3>
            </div>
            <div className="card-body text-sm space-y-3">
              <div>
                <p className="text-gray-500 text-xs">Status</p>
                <span
                  className={`badge ${
                    formData.isActive ? 'badge-green' : 'badge-red'
                  }`}
                >
                  {formData.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Created</p>
                <p>
                  {new Date(formData.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Last Updated</p>
                <p>
                  {new Date(formData.updatedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Available Merge Fields */}
          <div className="card mb-6">
            <div className="card-header">
              <h3 className="section-heading">Available Merge Fields</h3>
            </div>
            <div className="card-body">
              {categoryMergeFields[formData.category]?.length > 0 ? (
                <div className="space-y-2">
                  {categoryMergeFields[formData.category].map((field) => (
                    <label key={field} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.mergeFields?.includes(field) || false}
                        onChange={() => toggleMergeField(field)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                        {`{{${field}}}`}
                      </code>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No merge fields available for this category
                </p>
              )}
            </div>
          </div>

          {/* Live Preview */}
          {showPreview && (
            <div className="card">
              <div className="card-header">
                <h3 className="section-heading">Live Preview</h3>
              </div>
              <div className="card-body text-sm">
                <div className="mb-4">
                  <p className="text-xs text-gray-500 font-semibold mb-1">SUBJECT</p>
                  <p className="text-xs bg-gray-100 p-2 rounded break-words">
                    {preview.subject || '(empty)'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">BODY PREVIEW</p>
                  <div className="text-xs bg-gray-100 p-2 rounded max-h-64 overflow-y-auto whitespace-pre-wrap break-words">
                    {preview.body.substring(0, 500) || '(empty)'}...
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Fields shown as [field_name] where field_name will be replaced with actual values
                  when the template is used
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
