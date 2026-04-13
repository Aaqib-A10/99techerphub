'use client';

import { useState } from 'react';
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

const sampleData: Record<string, Record<string, string>> = {
  OFFER: {
    candidate_name: 'John Doe',
    position: 'Senior Software Engineer',
    department: 'Engineering',
    company_name: 'MNC',
    start_date: '2024-05-01',
    salary: '150000',
    currency: 'PKR',
    reporting_to: 'Jane Smith',
    probation_period: '3 months',
  },
  ONBOARDING: {
    candidate_name: 'Jane Smith',
    onboarding_url: 'https://99tech-erp.example.com/onboarding/token123',
    expiry_date: '2024-05-15',
    start_date: '2024-05-01',
  },
  EXPENSE: {
    employee_name: 'Ali Ahmed',
    expense_number: 'EXP-2024-001',
    amount: '5000 PKR',
    approver_name: 'Sarah Khan',
    approval_date: '2024-04-10',
    rejection_reason: 'Missing receipt for one item',
  },
  PAYROLL: {
    employee_name: 'Hassan Ali',
    period: 'April 2024',
    net_pay: '85000 PKR',
    payment_date: '2024-04-30',
    base_salary: '100000 PKR',
    allowances: '5000 PKR',
    gross_salary: '105000 PKR',
    deductions: '20000 PKR',
  },
  ASSET: {
    employee_name: 'Fatima Khan',
    asset_tag: 'LAPTOP-001',
    asset_category: 'Computer',
    model: 'MacBook Pro 16',
    serial_number: 'C02YQ2XWMD7N',
    assignment_date: '2024-04-01',
    assigned_by: 'Ahmed Hassan',
  },
  GENERAL: {},
};

export default function NewEmailTemplatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    templateKey: '',
    category: 'GENERAL',
    subject: '',
    bodyHtml: '',
    description: '',
    mergeFields: [] as string[],
  });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData({
      ...formData,
      name,
      templateKey: generateSlug(name).toUpperCase(),
    });
  };

  const handleTemplateKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      templateKey: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
    });
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value;
    setFormData({
      ...formData,
      category,
      mergeFields: categoryMergeFields[category] || [],
    });
  };

  const toggleMergeField = (field: string) => {
    setFormData((prev) => ({
      ...prev,
      mergeFields: prev.mergeFields.includes(field)
        ? prev.mergeFields.filter((f) => f !== field)
        : [...prev.mergeFields, field],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed to create template');
      }

      router.push('/settings/email-templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating template');
    } finally {
      setLoading(false);
    }
  };

  const preview = previewTemplate(
    formData.subject,
    formData.bodyHtml,
    formData.mergeFields
  );

  return (
    <div>
      <PageHero
        eyebrow="Settings / Email"
        title="Create Email Template"
        description="Create a new email template with merge fields for dynamic content"
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
                    onChange={handleNameChange}
                    placeholder="e.g., Offer Letter - Permanent"
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
                    onChange={handleTemplateKeyChange}
                    placeholder="Auto-generated from name, editable"
                    className="form-input font-mono text-sm"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Unique identifier for this template (auto-generated, must be unique)
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
                    placeholder="e.g., Offer of Employment - {{position}}"
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
                    placeholder="Enter HTML content for the email body"
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
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Describe when and how this template is used"
                    className="form-input"
                    rows={3}
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button type="submit" disabled={loading} className="btn btn-primary">
                    {loading ? 'Creating...' : 'Create Template'}
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
              </form>
            </div>
          </div>
        </div>

        {/* Sidebar with Merge Fields and Preview */}
        <div className="lg:col-span-1">
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
                        checked={formData.mergeFields.includes(field)}
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
