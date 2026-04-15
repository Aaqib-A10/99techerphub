'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PageHero from '@/app/components/PageHero';

const DRAFT_KEY = 'emp_form_draft';

function formatCnic(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

interface Department { id: number; name: string; }
interface Company { id: number; name: string; code: string; }
interface Location { id: number; name: string; }

export default function NewEmployeePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeSection, setActiveSection] = useState(0);

  const [showDraftPrompt, setShowDraftPrompt] = useState(false);

  const defaultFormData = {
    firstName: '',
    lastName: '',
    fatherName: '',
    email: '',
    phone: '',
    cnic: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    city: '',
    country: 'Pakistan',
    bloodGroup: '',
    maritalStatus: '',
    nationality: 'Pakistani',
    educationDegree: '',
    educationInstitution: '',
    educationYear: '',
    referenceName1: '',
    referencePhone1: '',
    referenceRelation1: '',
    referenceName2: '',
    referencePhone2: '',
    referenceRelation2: '',
    departmentId: '',
    companyIds: [] as number[],
    locationId: '',
    designation: '',
    employmentStatus: 'PERMANENT',
    dateOfJoining: '',
    probationEndDate: '',
    bankName: '',
    bankAccountNumber: '',
    bankBranch: '',
    baseSalary: '',
    currency: 'PKR',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
  };

  const [formData, setFormData] = useState(defaultFormData);

  useEffect(() => {
    fetch('/api/employees?meta=true').then((r) => r.json()).then((meta) => {
      setDepartments(meta.departments || []);
      setCompanies(meta.companies || []);
      setLocations(meta.locations || []);
    });
    // Check for saved draft
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setShowDraftPrompt(true);
    } catch {}
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const newValue = name === 'cnic' ? formatCnic(value) : value;
    setFormData((prev) => ({ ...prev, [name]: newValue }));
  };

  // Auto-save draft to localStorage
  useEffect(() => {
    const hasData = formData.firstName || formData.lastName || formData.email || formData.cnic || formData.designation;
    if (hasData) {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(formData)); } catch {}
    }
  }, [formData]);

  const restoreDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setFormData(JSON.parse(saved));
    } catch {}
    setShowDraftPrompt(false);
  };

  const discardDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setShowDraftPrompt(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        // Backward compat: set companyId to the first selected company
        companyId: formData.companyIds.length > 0 ? formData.companyIds[0] : '',
        education: formData.educationDegree ? {
          degree: formData.educationDegree,
          institution: formData.educationInstitution,
          year: formData.educationYear,
        } : null,
        references: formData.referenceName1 ? [
          { name: formData.referenceName1, phone: formData.referencePhone1, relation: formData.referenceRelation1 },
          ...(formData.referenceName2 ? [{ name: formData.referenceName2, phone: formData.referencePhone2, relation: formData.referenceRelation2 }] : []),
        ] : null,
      };

      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create employee');
      }

      const emp = await response.json();
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      router.push(`/employees/${emp.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    'Personal Information',
    'Additional Details',
    'Employment Details',
    'Banking & Salary',
    'Emergency Contact & References',
  ];

  // Check if all mandatory fields are filled
  const isFormComplete =
    formData.firstName.trim() !== '' &&
    formData.lastName.trim() !== '' &&
    formData.fatherName.trim() !== '' &&
    formData.email.trim() !== '' &&
    formData.phone.trim() !== '' &&
    formData.cnic.trim() !== '' &&
    formData.dateOfBirth !== '' &&
    formData.gender !== '' &&
    formData.departmentId !== '' &&
    formData.designation.trim() !== '' &&
    formData.employmentStatus !== '' &&
    formData.dateOfJoining !== '';

  return (
    <div>
      <PageHero
        eyebrow="People / Directory"
        title="Add New Employee"
        description="Complete onboarding form - all sections"
      />

      {showDraftPrompt && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-800">You have an unsaved draft. Would you like to resume?</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={restoreDraft} className="px-3 py-1.5 bg-brand-primary text-white rounded text-sm font-medium">
              Resume Draft
            </button>
            <button type="button" onClick={discardDraft} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded text-sm font-medium">
              Discard Draft
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">{error}</div>
      )}

      {/* Section Nav */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {sections.map((s, i) => (
          <button
            key={i}
            onClick={() => setActiveSection(i)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeSection === i ? 'bg-brand-primary text-white' : 'bg-white text-gray-600 border border-gray-300'
            }`}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Section 1: Personal Information */}
        {activeSection === 0 && (
          <div className="card mb-6">
            <div className="card-header"><h2 className="section-heading">Personal Information</h2></div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">First Name *</label>
                  <input name="firstName" value={formData.firstName} onChange={handleChange} required className="form-input" />
                </div>
                <div>
                  <label className="form-label">Last Name *</label>
                  <input name="lastName" value={formData.lastName} onChange={handleChange} required className="form-input" />
                </div>
                <div>
                  <label className="form-label">Father&apos;s Name *</label>
                  <input name="fatherName" value={formData.fatherName} onChange={handleChange} required className="form-input" />
                </div>
                <div>
                  <label className="form-label">Email *</label>
                  <input name="email" type="email" value={formData.email} onChange={handleChange} required className="form-input" />
                </div>
                <div>
                  <label className="form-label">Phone *</label>
                  <input name="phone" value={formData.phone} onChange={handleChange} required className="form-input" />
                </div>
                <div>
                  <label className="form-label">CNIC *</label>
                  <input name="cnic" value={formData.cnic} onChange={handleChange} required placeholder="XXXXX-XXXXXXX-X" maxLength={15} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Date of Birth *</label>
                  <input name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} required className="form-input" />
                </div>
                <div>
                  <label className="form-label">Gender *</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} required className="form-select">
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Country</label>
                  <select name="country" value={formData.country} onChange={handleChange} className="form-select">
                    <option value="Pakistan">Pakistan</option>
                    <option value="USA">USA</option>
                    <option value="UAE">UAE</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Address</label>
                  <input name="address" value={formData.address} onChange={handleChange} className="form-input" />
                </div>
                <div>
                  <label className="form-label">City</label>
                  <input name="city" value={formData.city} onChange={handleChange} className="form-input" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Additional Details (New Fields) */}
        {activeSection === 1 && (
          <div className="card mb-6">
            <div className="card-header"><h2 className="section-heading">Additional Personal Details</h2></div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Blood Group</label>
                  <select name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} className="form-select">
                    <option value="">Select</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Nationality</label>
                  <input name="nationality" value={formData.nationality} onChange={handleChange} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Marital Status</label>
                  <select name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} className="form-select">
                    <option value="">Select</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </div>
              </div>

              <h3 className="text-md font-bold mt-6 mb-3 text-gray-700">Education</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Highest Degree</label>
                  <select name="educationDegree" value={formData.educationDegree} onChange={handleChange} className="form-select">
                    <option value="">Select</option>
                    <option value="Matric">Matric / O-Levels</option>
                    <option value="Intermediate">Intermediate / A-Levels</option>
                    <option value="Bachelors">Bachelor&apos;s Degree</option>
                    <option value="Masters">Master&apos;s Degree</option>
                    <option value="PhD">PhD / Doctorate</option>
                    <option value="Diploma">Diploma / Certification</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Institution</label>
                  <input name="educationInstitution" value={formData.educationInstitution} onChange={handleChange} className="form-input" placeholder="University / College name" />
                </div>
                <div>
                  <label className="form-label">Year of Completion</label>
                  <input name="educationYear" value={formData.educationYear} onChange={handleChange} className="form-input" placeholder="e.g. 2020" />
                </div>
              </div>

              <h3 className="text-md font-bold mt-6 mb-3 text-gray-700">Required Documents</h3>
              <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
                <p className="font-medium mb-2">Upload documents after creating the employee. Required:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>CNIC Front & Back (PDF, PNG, JPG)</li>
                  <li>Photo - Passport Size (PNG, JPG)</li>
                  <li>Resume (PDF only)</li>
                  <li>Degree (optional - PDF, PNG, JPG)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Employment Details */}
        {activeSection === 2 && (
          <div className="card mb-6">
            <div className="card-header"><h2 className="section-heading">Employment Details</h2></div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Department *</label>
                  <select name="departmentId" value={formData.departmentId} onChange={handleChange} required className="form-select">
                    <option value="">Select Department</option>
                    {departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Companies</label>
                  <div
                    style={{
                      border: '1px solid #D1D5DB',
                      borderRadius: 8,
                      padding: '8px 12px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      minHeight: 42,
                      backgroundColor: '#fff',
                    }}
                  >
                    {companies.map((c) => {
                      const isChecked = formData.companyIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor: 'pointer',
                            padding: '4px 10px',
                            borderRadius: 9999,
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            backgroundColor: isChecked ? 'rgba(11, 31, 58, 0.08)' : 'transparent',
                            border: isChecked ? '1px solid rgba(11, 31, 58, 0.2)' : '1px solid #E5E7EB',
                            color: '#0B1F3A',
                            transition: 'all 0.15s',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setFormData((prev) => ({
                                ...prev,
                                companyIds: isChecked
                                  ? prev.companyIds.filter((id) => id !== c.id)
                                  : [...prev.companyIds, c.id],
                              }));
                            }}
                            style={{ accentColor: '#14B8A6', width: 14, height: 14 }}
                          />
                          {c.code || c.name}
                        </label>
                      );
                    })}
                    {companies.length === 0 && (
                      <span style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>Loading companies...</span>
                    )}
                  </div>
                  <p style={{ marginTop: 4, fontSize: '0.75rem', color: '#6B7280' }}>
                    Select one or more companies this employee works for
                  </p>
                </div>
                <div>
                  <label className="form-label">Location</label>
                  <select name="locationId" value={formData.locationId} onChange={handleChange} className="form-select">
                    <option value="">Select Location</option>
                    {locations.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Designation *</label>
                  <input name="designation" value={formData.designation} onChange={handleChange} required className="form-input" />
                </div>
                <div>
                  <label className="form-label">Employment Status *</label>
                  <select name="employmentStatus" value={formData.employmentStatus} onChange={handleChange} required className="form-select">
                    <option value="PERMANENT">Permanent</option>
                    <option value="PROBATION">Probation</option>
                    <option value="CONSULTANT">Consultant</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Date of Joining *</label>
                  <input name="dateOfJoining" type="date" value={formData.dateOfJoining} onChange={handleChange} required className="form-input" />
                </div>
                {formData.employmentStatus === 'PROBATION' && (
                  <div>
                    <label className="form-label">Probation End Date</label>
                    <input name="probationEndDate" type="date" value={formData.probationEndDate} onChange={handleChange} className="form-input" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Banking & Salary */}
        {activeSection === 3 && (
          <div className="card mb-6">
            <div className="card-header"><h2 className="section-heading">Banking & Salary Details</h2></div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Bank Name</label>
                  <input name="bankName" value={formData.bankName} onChange={handleChange} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Account Number</label>
                  <input name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleChange} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Branch</label>
                  <input name="bankBranch" value={formData.bankBranch} onChange={handleChange} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Base Salary</label>
                  <input name="baseSalary" type="number" value={formData.baseSalary} onChange={handleChange} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Currency</label>
                  <select name="currency" value={formData.currency} onChange={handleChange} className="form-select">
                    <option value="PKR">PKR</option>
                    <option value="USD">USD</option>
                    <option value="AED">AED</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 5: Emergency Contact & References */}
        {activeSection === 4 && (
          <div className="card mb-6">
            <div className="card-header"><h2 className="section-heading">Emergency Contact & References</h2></div>
            <div className="card-body">
              <h3 className="text-md font-bold mb-3 text-gray-700">Emergency Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="form-label">Contact Name</label>
                  <input name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Contact Phone</label>
                  <input name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleChange} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Relationship</label>
                  <input name="emergencyContactRelation" value={formData.emergencyContactRelation} onChange={handleChange} className="form-input" />
                </div>
              </div>

              <h3 className="text-md font-bold mb-3 text-gray-700">Reference 1</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="form-label">Name</label>
                  <input name="referenceName1" value={formData.referenceName1} onChange={handleChange} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input name="referencePhone1" value={formData.referencePhone1} onChange={handleChange} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Relation</label>
                  <input name="referenceRelation1" value={formData.referenceRelation1} onChange={handleChange} className="form-input" placeholder="e.g. Former Manager" />
                </div>
              </div>

              <h3 className="text-md font-bold mb-3 text-gray-700">Reference 2</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Name</label>
                  <input name="referenceName2" value={formData.referenceName2} onChange={handleChange} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input name="referencePhone2" value={formData.referencePhone2} onChange={handleChange} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Relation</label>
                  <input name="referenceRelation2" value={formData.referenceRelation2} onChange={handleChange} className="form-input" placeholder="e.g. Colleague" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation & Submit */}
        <div className="flex justify-between">
          <div className="flex gap-2">
            {activeSection > 0 && (
              <button type="button" onClick={() => setActiveSection(activeSection - 1)} className="btn btn-secondary">
                Previous
              </button>
            )}
            {activeSection < sections.length - 1 && (
              <button type="button" onClick={() => setActiveSection(activeSection + 1)} className="btn btn-secondary">
                Next
              </button>
            )}
          </div>
          <div className="flex gap-4">
            {activeSection === sections.length - 1 && (
              <button
                type="submit"
                disabled={loading || !isFormComplete}
                className="btn btn-primary"
                title={!isFormComplete ? 'Please fill all mandatory fields across all sections' : ''}
                style={!isFormComplete ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                {loading ? 'Creating...' : 'Create Employee'}
              </button>
            )}
            <button type="button" onClick={() => router.back()} className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      </form>
    </div>
  );
}
