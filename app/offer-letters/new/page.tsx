'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHero from '@/app/components/PageHero';

const COMPANIES = ['MNC', 'SJ', 'PCMART', 'RTI', 'LRI', 'Green Loop'];
const DEPARTMENTS = ['HR', 'IT', 'Finance', 'Operations', 'Sales', 'Marketing'];
const CURRENCIES = ['PKR', 'USD', 'AED'];
const CONTRACT_TYPES = ['REMOTE', 'HYBRID', 'ONSITE'];

export default function NewOfferLetterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [templateType, setTemplateType] = useState('PERMANENT');

  const [formData, setFormData] = useState({
    candidateName: '',
    candidateEmail: '',
    position: '',
    department: '',
    companyName: '',
    salary: '',
    currency: 'PKR',
    startDate: '',
    reportingTo: '',
    contractType: 'ONSITE',
    probationPeriod: '',
    commissionStructure: '',
    benefits: '',
    workingHours: '',
    terms: '',
    customBody: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTemplateChange = (type: string) => {
    setTemplateType(type);
  };

  const handleSubmit = async (e: React.FormEvent, asDraft: boolean = true) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.candidateName.trim()) {
        throw new Error('Candidate name is required');
      }
      if (!formData.position.trim()) {
        throw new Error('Position is required');
      }
      if (!formData.salary) {
        throw new Error('Salary is required');
      }
      if (!formData.startDate) {
        throw new Error('Start date is required');
      }

      const response = await fetch('/api/offer-letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          templateType,
          salary: parseFloat(formData.salary),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create offer letter');
      }

      const offerLetter = await response.json();
      router.push(`/offer-letters/${offerLetter.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHero
        eyebrow="People / Offers"
        title="Create Offer Letter"
        description="Generate and send employment offer letters"
      />

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <form>
        {/* Template Type Selection */}
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="section-heading">Offer Template Type</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['PERMANENT', 'PROBATION', 'CONSULTANT', 'CUSTOM'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTemplateChange(type)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    templateType === type
                      ? 'border-brand-primary bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-sm">
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Candidate Information */}
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="section-heading">Candidate Information</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Candidate Name *</label>
                <input
                  name="candidateName"
                  type="text"
                  value={formData.candidateName}
                  onChange={handleChange}
                  required
                  className="form-input"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="form-label">Candidate Email *</label>
                <input
                  name="candidateEmail"
                  type="email"
                  value={formData.candidateEmail}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="candidate@example.com"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Job Details */}
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="section-heading">Job Details</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Position *</label>
                <input
                  name="position"
                  type="text"
                  value={formData.position}
                  onChange={handleChange}
                  required
                  className="form-input"
                  placeholder="e.g., Senior Developer"
                />
              </div>
              <div>
                <label className="form-label">Department</label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Company</label>
                <select
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="">Select Company</option>
                  {COMPANIES.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Compensation */}
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="section-heading">Compensation & Benefits</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="form-label">Salary *</label>
                <input
                  name="salary"
                  type="number"
                  step="0.01"
                  value={formData.salary}
                  onChange={handleChange}
                  required
                  className="form-input"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="form-label">Currency</label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="form-select"
                >
                  {CURRENCIES.map((curr) => (
                    <option key={curr} value={curr}>
                      {curr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Start Date *</label>
                <input
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={handleChange}
                  required
                  className="form-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Reporting To</label>
                <input
                  name="reportingTo"
                  type="text"
                  value={formData.reportingTo}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Manager name/title"
                />
              </div>
              <div>
                <label className="form-label">Contract Type</label>
                <select
                  name="contractType"
                  value={formData.contractType}
                  onChange={handleChange}
                  className="form-select"
                >
                  {CONTRACT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="form-label">Benefits</label>
              <textarea
                name="benefits"
                value={formData.benefits}
                onChange={handleChange}
                rows={3}
                className="form-textarea"
                placeholder="Health insurance, stock options, PTO, etc."
              />
            </div>

            <div className="mt-4">
              <label className="form-label">Working Hours</label>
              <textarea
                name="workingHours"
                value={formData.workingHours}
                onChange={handleChange}
                rows={2}
                className="form-textarea"
                placeholder="e.g., Monday to Friday, 9 AM to 5 PM"
              />
            </div>

            <div className="mt-4">
              <label className="form-label">Terms & Conditions</label>
              <textarea
                name="terms"
                value={formData.terms}
                onChange={handleChange}
                rows={3}
                className="form-textarea"
                placeholder="Additional terms and conditions"
              />
            </div>
          </div>
        </div>

        {templateType === 'PROBATION' && (
          <div className="card mb-6">
            <div className="card-header">
              <h2 className="section-heading">Probation Details</h2>
            </div>
            <div className="card-body">
              <div>
                <label className="form-label">Probation Period *</label>
                <input
                  name="probationPeriod"
                  type="text"
                  value={formData.probationPeriod}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g., 3 months, 6 months"
                />
              </div>
            </div>
          </div>
        )}

        {templateType === 'CONSULTANT' && (
          <div className="card mb-6">
            <div className="card-header">
              <h2 className="section-heading">Commission Structure</h2>
            </div>
            <div className="card-body">
              <div>
                <label className="form-label">Commission Details *</label>
                <textarea
                  name="commissionStructure"
                  value={formData.commissionStructure}
                  onChange={handleChange}
                  rows={4}
                  className="form-textarea"
                  placeholder="Describe commission structure, rates, and payment terms"
                />
              </div>
            </div>
          </div>
        )}

        {templateType === 'CUSTOM' && (
          <div className="card mb-6">
            <div className="card-header">
              <h2 className="section-heading">Custom Letter Body</h2>
            </div>
            <div className="card-body">
              <div>
                <label className="form-label">Letter Content *</label>
                <textarea
                  name="customBody"
                  value={formData.customBody}
                  onChange={handleChange}
                  rows={8}
                  className="form-textarea"
                  placeholder="Enter the full offer letter content"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Variables: {`{candidateName}, {position}, {companyName}, {salary}, {currency}, {startDate}, {reportingTo}, {department}`}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            onClick={(e) => handleSubmit(e, true)}
            className="btn btn-secondary"
          >
            {loading ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            type="submit"
            disabled={loading}
            onClick={(e) => handleSubmit(e, false)}
            className="btn btn-primary"
          >
            {loading ? 'Creating...' : 'Create Offer Letter'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
