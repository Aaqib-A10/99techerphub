'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function formatCnic(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

function formatIban(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 24);
}

interface OnboardingSubmission {
  id: number;
  candidateName: string | null;
  candidateEmail: string | null;
  token: string | null;
}

interface FormData {
  // Section 1: Personal Details
  fullName: string;
  fatherName: string;
  cnic: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  nationality: string;
  bloodGroup: string;
  passportNumber: string;
  passportExpiry: string;
  // Section 2: Contact & Emergency
  personalEmail: string;
  phone: string;
  currentAddress: string;
  city: string;
  country: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  // Section 3: Banking
  iban: string;
  accountNumber: string;
  bankName: string;
  accountTitle: string;
  // Section 4: Education
  educationHistory: Array<{
    degree: string;
    institution: string;
    year: string;
    gpa: string;
  }>;
  // Section 5: Work History
  workHistory: Array<{
    company: string;
    position: string;
    from: string;
    to: string;
    reasonForLeaving: string;
  }>;
  // Section 6: References
  references: Array<{
    name: string;
    relationship: string;
    phone: string;
    email: string;
  }>;
  // Section 7: Certification
  certifyCorrective: boolean;
}

const sections = [
  'Personal Details',
  'Contact & Emergency',
  'Banking Details',
  'Education History',
  'Work History',
  'References',
  'Review & Submit',
];

export default function OnboardingForm({
  token,
  initialSubmission,
}: {
  token: string;
  initialSubmission: OnboardingSubmission;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState(0);
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState<FormData>({
    fullName: initialSubmission.candidateName || '',
    fatherName: '',
    cnic: '',
    dateOfBirth: '',
    gender: '',
    maritalStatus: '',
    nationality: '',
    bloodGroup: '',
    passportNumber: '',
    passportExpiry: '',
    personalEmail: initialSubmission.candidateEmail || '',
    phone: '',
    currentAddress: '',
    city: '',
    country: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    iban: '',
    accountNumber: '',
    bankName: '',
    accountTitle: '',
    educationHistory: [{ degree: '', institution: '', year: '', gpa: '' }],
    workHistory: [{ company: '', position: '', from: '', to: '', reasonForLeaving: '' }],
    references: [{ name: '', relationship: '', phone: '', email: '' }],
    certifyCorrective: false,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData({
        ...formData,
        [name]: (e.target as HTMLInputElement).checked,
      });
      return;
    }
    let nextValue = value;
    if (name === 'cnic') nextValue = formatCnic(value);
    else if (name === 'iban') nextValue = formatIban(value);
    setFormData({ ...formData, [name]: nextValue });
  };

  const handleEducationChange = (index: number, field: string, value: string) => {
    const newEducation = [...formData.educationHistory];
    newEducation[index] = { ...newEducation[index], [field]: value };
    setFormData({ ...formData, educationHistory: newEducation });
  };

  const addEducation = () => {
    setFormData({
      ...formData,
      educationHistory: [
        ...formData.educationHistory,
        { degree: '', institution: '', year: '', gpa: '' },
      ],
    });
  };

  const removeEducation = (index: number) => {
    setFormData({
      ...formData,
      educationHistory: formData.educationHistory.filter((_, i) => i !== index),
    });
  };

  const handleWorkChange = (index: number, field: string, value: string) => {
    const newWork = [...formData.workHistory];
    newWork[index] = { ...newWork[index], [field]: value };
    setFormData({ ...formData, workHistory: newWork });
  };

  const addWork = () => {
    setFormData({
      ...formData,
      workHistory: [
        ...formData.workHistory,
        { company: '', position: '', from: '', to: '', reasonForLeaving: '' },
      ],
    });
  };

  const removeWork = (index: number) => {
    setFormData({
      ...formData,
      workHistory: formData.workHistory.filter((_, i) => i !== index),
    });
  };

  const handleReferenceChange = (index: number, field: string, value: string) => {
    const newRefs = [...formData.references];
    newRefs[index] = { ...newRefs[index], [field]: value };
    setFormData({ ...formData, references: newRefs });
  };

  const addReference = () => {
    setFormData({
      ...formData,
      references: [...formData.references, { name: '', relationship: '', phone: '', email: '' }],
    });
  };

  const removeReference = (index: number) => {
    setFormData({
      ...formData,
      references: formData.references.filter((_, i) => i !== index),
    });
  };

  const validateSection = (section: number) => {
    const requiredFields = {
      0: ['fullName', 'cnic', 'dateOfBirth', 'gender'],
      1: ['personalEmail', 'phone', 'currentAddress', 'city'],
      2: ['iban', 'bankName', 'accountTitle'],
      3: [],
      4: [],
      5: [],
      6: [],
    };

    const required = requiredFields[section as keyof typeof requiredFields] || [];
    for (const field of required) {
      if (!formData[field as keyof FormData]) {
        setError(`Please fill in all required fields before proceeding.`);
        return false;
      }
    }

    if (section === 0) {
      const cnicDigits = formData.cnic.replace(/\D/g, '');
      if (cnicDigits.length !== 13) {
        setError('CNIC must be exactly 13 digits.');
        return false;
      }
      const dob = new Date(formData.dateOfBirth);
      const dobYear = dob.getFullYear();
      if (Number.isNaN(dob.getTime()) || dobYear < 1900 || dob > new Date()) {
        setError('Please enter a valid date of birth (year between 1900 and today).');
        return false;
      }
      if (formData.passportExpiry) {
        const exp = new Date(formData.passportExpiry);
        if (Number.isNaN(exp.getTime()) || exp < new Date(today)) {
          setError('Passport expiry must be today or later.');
          return false;
        }
      }
    }

    if (section === 2 && formData.iban.length !== 24) {
      setError('IBAN must be exactly 24 characters.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateSection(activeSection)) {
      setError('');
      setActiveSection(activeSection + 1);
    }
  };

  const handlePrevious = () => {
    setError('');
    setActiveSection(activeSection - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.certifyCorrective) {
      setError('Please certify that all information is true and accurate.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        personalDetails: {
          fullName: formData.fullName,
          fatherName: formData.fatherName,
          cnic: formData.cnic,
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender,
          maritalStatus: formData.maritalStatus,
          nationality: formData.nationality,
          bloodGroup: formData.bloodGroup,
          passportNumber: formData.passportNumber,
          passportExpiry: formData.passportExpiry,
        },
        emergencyContact: {
          name: formData.emergencyContactName,
          phone: formData.emergencyContactPhone,
          relationship: formData.emergencyContactRelation,
        },
        bankDetails: {
          iban: formData.iban,
          accountNumber: formData.accountNumber,
          bankName: formData.bankName,
          accountTitle: formData.accountTitle,
        },
        educationHistory: formData.educationHistory.filter((e) => e.degree),
        workHistory: formData.workHistory.filter((w) => w.company),
        references: formData.references.filter((r) => r.name),
      };

      const response = await fetch(`/api/onboarding/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit onboarding');
      }

      // Show success state - refresh the page to show success message
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-light py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-primary">99 Technologies</h1>
          <p className="text-gray-600 mt-2">Candidate Onboarding Form</p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {sections.map((section, index) => (
              <div key={index} className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                    index === activeSection
                      ? 'bg-brand-primary text-white'
                      : index < activeSection
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {index < activeSection ? '✓' : index + 1}
                </div>
                <span className="text-xs mt-2 text-center w-16 text-gray-700">
                  {section.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Section 1: Personal Details */}
            {activeSection === 0 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-6">Personal Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Full Name *</label>
                    <input
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Father&apos;s Name</label>
                    <input
                      name="fatherName"
                      value={formData.fatherName}
                      onChange={handleChange}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">CNIC / National ID *</label>
                    <input
                      name="cnic"
                      value={formData.cnic}
                      onChange={handleChange}
                      required
                      placeholder="XXXXX-XXXXXXX-X"
                      maxLength={15}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Date of Birth *</label>
                    <input
                      name="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      required
                      min="1900-01-01"
                      max={today}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Gender *</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      required
                      className="form-select"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Marital Status</label>
                    <select
                      name="maritalStatus"
                      value={formData.maritalStatus}
                      onChange={handleChange}
                      className="form-select"
                    >
                      <option value="">Select</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Nationality</label>
                    <input
                      name="nationality"
                      value={formData.nationality}
                      onChange={handleChange}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Blood Group</label>
                    <select
                      name="bloodGroup"
                      value={formData.bloodGroup}
                      onChange={handleChange}
                      className="form-select"
                    >
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
                    <label className="form-label">Passport Number</label>
                    <input
                      name="passportNumber"
                      value={formData.passportNumber}
                      onChange={handleChange}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Passport Expiry</label>
                    <input
                      name="passportExpiry"
                      type="date"
                      value={formData.passportExpiry}
                      onChange={handleChange}
                      min={today}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 2: Contact & Emergency */}
            {activeSection === 1 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-6">Contact & Emergency</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Personal Email *</label>
                      <input
                        name="personalEmail"
                        type="email"
                        value={formData.personalEmail}
                        onChange={handleChange}
                        required
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Phone *</label>
                      <input
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Current Address *</label>
                    <textarea
                      name="currentAddress"
                      value={formData.currentAddress}
                      onChange={handleChange}
                      required
                      className="form-input"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">City *</label>
                      <input
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        required
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Country</label>
                      <input
                        name="country"
                        value={formData.country}
                        onChange={handleChange}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-6 mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Emergency Contact
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="form-label">Contact Name</label>
                        <input
                          name="emergencyContactName"
                          value={formData.emergencyContactName}
                          onChange={handleChange}
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="form-label">Contact Phone</label>
                        <input
                          name="emergencyContactPhone"
                          value={formData.emergencyContactPhone}
                          onChange={handleChange}
                          className="form-input"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="form-label">Relationship</label>
                        <input
                          name="emergencyContactRelation"
                          value={formData.emergencyContactRelation}
                          onChange={handleChange}
                          className="form-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Banking Details */}
            {activeSection === 2 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-6">Banking Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="form-label">IBAN *</label>
                    <input
                      name="iban"
                      value={formData.iban}
                      onChange={handleChange}
                      required
                      placeholder="PK00AAAA0000000000000000"
                      maxLength={24}
                      className="form-input font-mono tracking-wide"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Must be exactly 24 characters. {formData.iban.length}/24 entered.
                    </p>
                  </div>
                  <div>
                    <label className="form-label">Account Number</label>
                    <input
                      name="accountNumber"
                      value={formData.accountNumber}
                      onChange={handleChange}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Bank Name *</label>
                    <input
                      name="bankName"
                      value={formData.bankName}
                      onChange={handleChange}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="form-label">Account Title *</label>
                    <input
                      name="accountTitle"
                      value={formData.accountTitle}
                      onChange={handleChange}
                      required
                      className="form-input"
                      placeholder="Name as it appears on the account"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Education History */}
            {activeSection === 3 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-6">Education History</h2>
                <div className="space-y-4">
                  {formData.educationHistory.map((edu, index) => (
                    <div
                      key={index}
                      className="p-4 border border-gray-300 rounded-lg bg-gray-50"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-gray-900">Education {index + 1}</h4>
                        {formData.educationHistory.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEducation(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="form-label">Degree</label>
                          <input
                            value={edu.degree}
                            onChange={(e) =>
                              handleEducationChange(index, 'degree', e.target.value)
                            }
                            className="form-input"
                            placeholder="e.g. Bachelor of Science"
                          />
                        </div>
                        <div>
                          <label className="form-label">Institution</label>
                          <input
                            value={edu.institution}
                            onChange={(e) =>
                              handleEducationChange(index, 'institution', e.target.value)
                            }
                            className="form-input"
                            placeholder="University/College name"
                          />
                        </div>
                        <div>
                          <label className="form-label">Year</label>
                          <input
                            value={edu.year}
                            onChange={(e) => handleEducationChange(index, 'year', e.target.value)}
                            className="form-input"
                            placeholder="e.g. 2020"
                          />
                        </div>
                        <div>
                          <label className="form-label">GPA</label>
                          <input
                            value={edu.gpa}
                            onChange={(e) => handleEducationChange(index, 'gpa', e.target.value)}
                            className="form-input"
                            placeholder="e.g. 3.8"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addEducation}
                    className="btn btn-secondary text-sm"
                  >
                    + Add Education
                  </button>
                </div>
              </div>
            )}

            {/* Section 5: Work History */}
            {activeSection === 4 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-6">Work History</h2>
                <div className="space-y-4">
                  {formData.workHistory.map((work, index) => (
                    <div
                      key={index}
                      className="p-4 border border-gray-300 rounded-lg bg-gray-50"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-gray-900">Position {index + 1}</h4>
                        {formData.workHistory.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeWork(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="form-label">Company</label>
                          <input
                            value={work.company}
                            onChange={(e) => handleWorkChange(index, 'company', e.target.value)}
                            className="form-input"
                            placeholder="Company name"
                          />
                        </div>
                        <div>
                          <label className="form-label">Position</label>
                          <input
                            value={work.position}
                            onChange={(e) => handleWorkChange(index, 'position', e.target.value)}
                            className="form-input"
                            placeholder="Job title"
                          />
                        </div>
                        <div>
                          <label className="form-label">From (Month/Year)</label>
                          <input
                            value={work.from}
                            onChange={(e) => handleWorkChange(index, 'from', e.target.value)}
                            className="form-input"
                            placeholder="e.g. Jan 2020"
                          />
                        </div>
                        <div>
                          <label className="form-label">To (Month/Year)</label>
                          <input
                            value={work.to}
                            onChange={(e) => handleWorkChange(index, 'to', e.target.value)}
                            className="form-input"
                            placeholder="e.g. Dec 2021"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="form-label">Reason for Leaving</label>
                          <input
                            value={work.reasonForLeaving}
                            onChange={(e) =>
                              handleWorkChange(index, 'reasonForLeaving', e.target.value)
                            }
                            className="form-input"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addWork}
                    className="btn btn-secondary text-sm"
                  >
                    + Add Work Experience
                  </button>
                </div>
              </div>
            )}

            {/* Section 6: References */}
            {activeSection === 5 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-6">References</h2>
                <div className="space-y-4">
                  {formData.references.map((ref, index) => (
                    <div
                      key={index}
                      className="p-4 border border-gray-300 rounded-lg bg-gray-50"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-gray-900">Reference {index + 1}</h4>
                        {formData.references.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeReference(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="form-label">Name</label>
                          <input
                            value={ref.name}
                            onChange={(e) => handleReferenceChange(index, 'name', e.target.value)}
                            className="form-input"
                          />
                        </div>
                        <div>
                          <label className="form-label">Relationship</label>
                          <input
                            value={ref.relationship}
                            onChange={(e) =>
                              handleReferenceChange(index, 'relationship', e.target.value)
                            }
                            className="form-input"
                            placeholder="e.g. Former Manager"
                          />
                        </div>
                        <div>
                          <label className="form-label">Phone</label>
                          <input
                            value={ref.phone}
                            onChange={(e) => handleReferenceChange(index, 'phone', e.target.value)}
                            className="form-input"
                          />
                        </div>
                        <div>
                          <label className="form-label">Email</label>
                          <input
                            type="email"
                            value={ref.email}
                            onChange={(e) => handleReferenceChange(index, 'email', e.target.value)}
                            className="form-input"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addReference}
                    className="btn btn-secondary text-sm"
                  >
                    + Add Reference
                  </button>
                </div>
              </div>
            )}

            {/* Section 7: Review & Submit */}
            {activeSection === 6 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-6">Review & Submit</h2>
                <div className="space-y-6">
                  {/* Personal Details Summary */}
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-3">Personal Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <p>
                        <span className="font-medium">Full Name:</span> {formData.fullName}
                      </p>
                      <p>
                        <span className="font-medium">Gender:</span> {formData.gender}
                      </p>
                      <p>
                        <span className="font-medium">CNIC:</span> {formData.cnic}
                      </p>
                      <p>
                        <span className="font-medium">Blood Group:</span> {formData.bloodGroup}
                      </p>
                    </div>
                  </div>

                  {/* Contact Summary */}
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-3">Contact Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <p>
                        <span className="font-medium">Email:</span> {formData.personalEmail}
                      </p>
                      <p>
                        <span className="font-medium">Phone:</span> {formData.phone}
                      </p>
                      <p className="md:col-span-2">
                        <span className="font-medium">City:</span> {formData.city}
                      </p>
                    </div>
                  </div>

                  {/* Banking Summary */}
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-3">Banking Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <p className="md:col-span-2">
                        <span className="font-medium">IBAN:</span>{' '}
                        <span className="font-mono">{formData.iban}</span>
                      </p>
                      <p>
                        <span className="font-medium">Bank:</span> {formData.bankName}
                      </p>
                      <p>
                        <span className="font-medium">Account Title:</span>{' '}
                        {formData.accountTitle}
                      </p>
                      {formData.accountNumber && (
                        <p className="md:col-span-2">
                          <span className="font-medium">Account Number:</span>{' '}
                          {formData.accountNumber}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Certification Checkbox */}
                  <div className="border-t pt-6 mt-6">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        name="certifyCorrective"
                        checked={formData.certifyCorrective}
                        onChange={handleChange}
                        className="mt-1"
                      />
                      <span className="text-sm text-gray-700">
                        I certify that all information provided in this form is true and accurate.
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <div className="flex gap-2">
                {activeSection > 0 && (
                  <button
                    type="button"
                    onClick={handlePrevious}
                    className="btn btn-secondary"
                  >
                    Previous
                  </button>
                )}
              </div>
              <div className="flex gap-4">
                {activeSection < sections.length - 1 && (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="btn btn-secondary"
                  >
                    Next
                  </button>
                )}
                {activeSection === sections.length - 1 && (
                  <button
                    type="submit"
                    disabled={loading || !formData.certifyCorrective}
                    className="btn btn-primary text-lg px-8 py-3"
                  >
                    {loading ? 'Submitting...' : 'Submit'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
