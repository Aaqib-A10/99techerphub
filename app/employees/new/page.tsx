'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import PageHero from '@/app/components/PageHero';
import DocumentDropzone, { DocTypeSpec } from '@/app/components/DocumentDropzone';

const DRAFT_KEY = 'emp_form_draft';

const DOCUMENT_TYPES: DocTypeSpec[] = [
  { value: 'CNIC_FRONT', label: 'CNIC Front', accept: '.pdf,.png,.jpg,.jpeg', required: true },
  { value: 'CNIC_BACK', label: 'CNIC Back', accept: '.pdf,.png,.jpg,.jpeg', required: true },
  { value: 'PHOTO', label: 'Passport-size Photo', accept: '.png,.jpg,.jpeg', required: true },
  { value: 'RESUME', label: 'Resume', accept: '.pdf', required: true },
  { value: 'DEGREE', label: 'Degree', accept: '.pdf,.png,.jpg,.jpeg' },
  { value: 'CONTRACT', label: 'Contract', accept: '.pdf,.png,.jpg,.jpeg' },
  { value: 'NDA', label: 'NDA', accept: '.pdf,.png,.jpg,.jpeg' },
  { value: 'OFFER_LETTER', label: 'Offer Letter', accept: '.pdf,.png,.jpg,.jpeg' },
  { value: 'EXPERIENCE_LETTER', label: 'Experience Letter', accept: '.pdf,.png,.jpg,.jpeg' },
  { value: 'OTHER', label: 'Other', accept: '.pdf,.png,.jpg,.jpeg' },
];

function formatCnic(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

interface Department { id: number; name: string; }
interface Company { id: number; name: string; code: string; }
interface Location { id: number; name: string; }

const sectionNav = [
  { id: 'section-personal', label: 'Personal Information' },
  { id: 'section-additional', label: 'Additional Details' },
  { id: 'section-employment', label: 'Employment Details' },
  { id: 'section-banking', label: 'Banking & Salary' },
  { id: 'section-emergency', label: 'Emergency & References' },
  { id: 'section-documents', label: 'Documents' },
];

export default function NewEmployeePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeId, setActiveId] = useState(sectionNav[0].id);

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
    team: '',
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

  // Documents staged for upload after employee creation
  const [stagedDocs, setStagedDocs] = useState<Record<string, File>>({});
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const setStagedDoc = (type: string, file: File | null) => {
    setStagedDocs((prev) => {
      const next = { ...prev };
      if (file) next[type] = file;
      else delete next[type];
      return next;
    });
  };

  // IntersectionObserver for sticky sidebar highlight
  useEffect(() => {
    const ids = sectionNav.map((s) => s.id);
    const elements = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

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

      // Upload staged documents (best-effort; partial failures don't block)
      const entries = Object.entries(stagedDocs);
      const failed: string[] = [];
      if (entries.length > 0) {
        for (let i = 0; i < entries.length; i++) {
          const [docType, file] = entries[i];
          const label = DOCUMENT_TYPES.find((d) => d.value === docType)?.label || docType;
          setUploadStatus(`Uploading ${label} (${i + 1}/${entries.length})...`);
          try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('documentType', docType);
            const docRes = await fetch(`/api/employees/${emp.id}/documents`, {
              method: 'POST',
              body: fd,
            });
            if (!docRes.ok) {
              const data = await docRes.json().catch(() => ({}));
              throw new Error(data.error || 'Upload failed');
            }
          } catch (e) {
            failed.push(label);
          }
        }
      }

      if (failed.length > 0) {
        setUploadStatus(
          `Employee created, but some documents failed to upload (${failed.join(', ')}). You can retry from the employee detail page.`
        );
        // Still navigate — employee exists, docs can be retried
        setTimeout(() => router.push(`/employees/${emp.id}`), 2500);
        return;
      }

      router.push(`/employees/${emp.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setUploadStatus('');
    } finally {
      setLoading(false);
    }
  };

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

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

      <div className="flex gap-6">
        {/* Sticky sidebar nav - hidden on mobile */}
        <nav className="hidden lg:block w-48 flex-shrink-0">
          <div className="sticky top-24 space-y-1">
            {sectionNav.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollTo(s.id)}
                className={`block w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeId === s.id
                    ? 'bg-brand-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Main form content */}
        <div className="flex-1 min-w-0">
          <form onSubmit={handleSubmit}>
            {/* Section 1: Personal Information */}
            <div id="section-personal" className="card mb-6 scroll-mt-24">
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

            {/* Section 2: Additional Details */}
            <div id="section-additional" className="card mb-6 scroll-mt-24">
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

            {/* Section 3: Employment Details */}
            <div id="section-employment" className="card mb-6 scroll-mt-24">
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
                    <label className="form-label">Team</label>
                    <input name="team" value={formData.team} onChange={handleChange} className="form-input" placeholder="e.g. Frontend, Backend, QA" />
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

            {/* Section 4: Banking & Salary */}
            <div id="section-banking" className="card mb-6 scroll-mt-24">
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

            {/* Section 5: Emergency Contact & References */}
            <div id="section-emergency" className="card mb-6 scroll-mt-24">
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

            {/* Documents (optional pre-create) */}
            <div id="section-documents" className="card mb-6 scroll-mt-24">
              <div className="card-header">
                <h2 className="text-lg font-bold">Documents</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Drag &amp; drop files now or add them after creation. Required docs are highlighted red until staged.
                </p>
              </div>
              <div className="card-body">
                <h3 className="text-md font-bold mb-3 text-gray-700">Required</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {DOCUMENT_TYPES.filter((d) => d.required).map((dt) => (
                    <DocumentDropzone
                      key={dt.value}
                      docType={dt}
                      stagedFile={stagedDocs[dt.value] || null}
                      onStaged={(f) => setStagedDoc(dt.value, f)}
                      disabled={loading}
                    />
                  ))}
                </div>
                <h3 className="text-md font-bold mb-3 text-gray-700">Optional</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {DOCUMENT_TYPES.filter((d) => !d.required).map((dt) => (
                    <DocumentDropzone
                      key={dt.value}
                      docType={dt}
                      stagedFile={stagedDocs[dt.value] || null}
                      onStaged={(f) => setStagedDoc(dt.value, f)}
                      disabled={loading}
                    />
                  ))}
                </div>
              </div>
            </div>

            {uploadStatus && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-sm">
                {uploadStatus}
              </div>
            )}

            {/* Submit & Cancel */}
            <div className="flex justify-end gap-4 pb-8">
              <button type="button" onClick={() => router.back()} className="btn btn-secondary" disabled={loading}>Cancel</button>
              <button
                type="submit"
                disabled={loading || !isFormComplete}
                className="btn btn-primary"
                title={!isFormComplete ? 'Please fill all mandatory fields across all sections' : ''}
                style={!isFormComplete ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                {loading ? (uploadStatus || 'Creating...') : 'Create Employee'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
