'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import OnboardingChecklistPanel from './OnboardingChecklistPanel';
import { getTeam } from '../client';

function formatCnic(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

interface EmployeeDetailClientProps {
  employee: any;
  allEmployees: { id: number; firstName: string; lastName: string; empCode: string }[];
  departments?: { id: number; code: string; name: string }[];
  companies?: { id: number; code: string; name: string }[];
  locations?: { id: number; name: string }[];
  directReports?: {
    id: number;
    firstName: string;
    lastName: string;
    empCode: string;
    designation: string;
    department: { name: string };
  }[];
  employeeCompanies?: { id: number; code: string; name: string }[];
}

export default function EmployeeDetailClient({
  employee,
  allEmployees,
  departments = [],
  companies = [],
  locations = [],
  directReports = [],
  employeeCompanies = [],
}: EmployeeDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('personal');
  const [showExitModal, setShowExitModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTab, setEditingTab] = useState<'personal' | 'employment' | 'banking' | null>(null);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState('');
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelineHasMore, setTimelineHasMore] = useState(false);

  const [exitData, setExitData] = useState({
    exitDate: '',
    reason: '',
    exitType: 'RESIGNATION',
  });

  const [accessData, setAccessData] = useState({
    serviceName: '',
    accountId: '',
    notes: '',
  });

  // Edit form state
  const [editFormData, setEditFormData] = useState<any>({
    // Personal
    firstName: employee.firstName,
    lastName: employee.lastName,
    fatherName: employee.fatherName,
    email: employee.email,
    phone: employee.phone,
    cnic: employee.cnic,
    dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth).toISOString().split('T')[0] : '',
    gender: employee.gender,
    address: employee.address,
    permanentAddress: employee.permanentAddress,
    city: employee.city,
    country: employee.country,
    bloodGroup: employee.bloodGroup,
    passportNumber: employee.passportNumber,
    passportExpiry: employee.passportExpiry ? new Date(employee.passportExpiry).toISOString().split('T')[0] : '',
    maritalStatus: employee.maritalStatus,
    nationality: employee.nationality,
    emergencyContactName: employee.emergencyContactName,
    emergencyContactPhone: employee.emergencyContactPhone,
    emergencyContactRelation: employee.emergencyContactRelation,
    // Employment
    departmentId: employee.departmentId,
    companyIds: employeeCompanies.length > 0
      ? employeeCompanies.map((c: any) => c.id)
      : employee.companyId ? [employee.companyId] : [],
    locationId: employee.locationId,
    designation: employee.designation,
    employmentStatus: employee.employmentStatus,
    lifecycleStage: employee.lifecycleStage,
    probationEndDate: employee.probationEndDate ? new Date(employee.probationEndDate).toISOString().split('T')[0] : '',
    reportingManagerId: employee.reportingManagerId,
    dateOfJoining: employee.dateOfJoining ? new Date(employee.dateOfJoining).toISOString().split('T')[0] : '',
    // Banking
    bankName: employee.bankName,
    bankAccountNumber: employee.bankAccountNumber,
    bankBranch: employee.bankBranch,
    bankAccountStatus: employee.bankAccountStatus,
    // Background & Education
    lastDegree: employee.lastDegree,
    previousOrganization: employee.previousOrganization,
    referenceCheck: employee.referenceCheck,
  });

  // Exit clearance state
  const [clearanceStatus, setClearanceStatus] = useState<any>(
    employee.exitRecord?.clearanceStatus || {
      assetsReturned: false,
      digitalAccessRevoked: false,
      financialSettlement: false,
      documentsCollected: false,
    }
  );

  // Fetch timeline data when tab becomes active
  useEffect(() => {
    if (activeTab === 'timeline' && timelineData.length === 0) {
      fetchTimeline(1);
    }
  }, [activeTab]);

  const fetchTimeline = async (page: number) => {
    setTimelineLoading(true);
    setTimelineError('');
    try {
      const response = await fetch(`/api/employees/${employee.id}/timeline?page=${page}&limit=20`);
      if (!response.ok) throw new Error('Failed to fetch timeline');
      const result = await response.json();
      if (page === 1) {
        setTimelineData(result.timeline);
      } else {
        setTimelineData((prev) => [...prev, ...result.timeline]);
      }
      setTimelinePage(page);
      setTimelineHasMore(result.pagination.hasMore);
    } catch (err) {
      setTimelineError(err instanceof Error ? err.message : 'Error loading timeline');
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleLoadMoreTimeline = () => {
    fetchTimeline(timelinePage + 1);
  };

  const handleInitiateExit = async () => {
    router.push(`/employees/${employee.id}/exit`);
    setShowExitModal(false);
  };

  const handleGrantAccess = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/digital-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee.id, ...accessData }),
      });
      if (!response.ok) throw new Error('Failed to grant access');
      router.refresh();
      setShowAccessModal(false);
      setAccessData({ serviceName: '', accountId: '', notes: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAccess = async (accessId: number) => {
    try {
      await fetch(`/api/digital-access?id=${accessId}`, { method: 'DELETE' });
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', ...editFormData }),
      });
      if (!response.ok) throw new Error('Failed to save profile');
      const result = await response.json();
      setIsEditMode(false);
      setEditingTab(null);
      const count = Array.isArray(result?.changedFields) ? result.changedFields.length : 0;
      setSuccessMsg(
        count > 0
          ? `Saved ${count} change${count === 1 ? '' : 's'} — logged to audit trail.`
          : 'No changes to save.'
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  // Auto-dismiss success toast after 4s
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(''), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const handleClearanceToggle = async (field: string) => {
    const newStatus = { ...clearanceStatus, [field]: !clearanceStatus[field] };
    setClearanceStatus(newStatus);

    try {
      const response = await fetch(`/api/employees/${employee.id}/exit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearanceStatus: newStatus }),
      });
      if (!response.ok) throw new Error('Failed to update clearance status');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      // Revert on error
      setClearanceStatus(clearanceStatus);
    }
  };

  const handleCompleteExit = async () => {
    if (!Object.values(clearanceStatus).every(Boolean)) {
      setError('All clearance items must be completed before marking exit as complete.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/employees/${employee.id}/exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to complete exit');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Personal' },
    { id: 'employment', label: 'Employment' },
    { id: 'onboarding', label: 'Onboarding' },
    { id: 'assets', label: 'Assets' },
    { id: 'digital', label: 'Digital Access' },
    { id: 'finance', label: 'Finance' },
    { id: 'documents', label: 'Documents' },
    { id: 'timeline', label: 'Timeline' },
  ];

  return (
    <>
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded flex items-start justify-between gap-3">
          <span className="text-sm">{error}</span>
          <button
            onClick={() => setError('')}
            className="text-red-700 hover:text-red-900 text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-300 text-green-800 rounded flex items-start justify-between gap-3">
          <span className="text-sm">✓ {successMsg}</span>
          <button
            onClick={() => setSuccessMsg('')}
            className="text-green-700 hover:text-green-900 text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="profile-tabs mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`profile-tab ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Personal Tab */}
      {activeTab === 'personal' && (
        <>
          <div className="mb-4 flex gap-2">
            {!isEditMode ? (
              <button
                onClick={() => {
                  setIsEditMode(true);
                  setEditingTab('personal');
                }}
                className="btn btn-primary"
                style={{ backgroundColor: '#0B1F3A' }}
              >
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ backgroundColor: '#0B1F3A' }}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setIsEditMode(false);
                    setEditingTab(null);
                  }}
                  className="btn"
                  style={{ backgroundColor: '#f0f0f0', color: '#333' }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="card-header"><h3 className="section-heading">Personal Details</h3></div>
              <div className="card-body space-y-3">
                {editingTab === 'personal' && isEditMode ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">First Name</label>
                        <input
                          type="text"
                          value={editFormData.firstName}
                          onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="form-label">Last Name</label>
                        <input
                          type="text"
                          value={editFormData.lastName}
                          onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                          className="form-input"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Father's Name</label>
                      <input
                        type="text"
                        value={editFormData.fatherName}
                        onChange={(e) => setEditFormData({ ...editFormData, fatherName: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        value={editFormData.email}
                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Phone</label>
                      <input
                        type="tel"
                        value={editFormData.phone}
                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">CNIC</label>
                      <input
                        type="text"
                        value={editFormData.cnic || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, cnic: formatCnic(e.target.value) })}
                        className="form-input"
                        placeholder="XXXXX-XXXXXXX-X"
                        maxLength={15}
                      />
                    </div>
                    <div>
                      <label className="form-label">Date of Birth</label>
                      <input
                        type="date"
                        value={editFormData.dateOfBirth}
                        onChange={(e) => setEditFormData({ ...editFormData, dateOfBirth: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Gender</label>
                      <select
                        value={editFormData.gender || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                        className="form-select"
                      >
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Blood Group</label>
                      <select
                        value={editFormData.bloodGroup || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, bloodGroup: e.target.value })}
                        className="form-select"
                      >
                        <option value="">Select Blood Group</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Address</label>
                      <input
                        type="text"
                        value={editFormData.address}
                        onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">City</label>
                        <input
                          type="text"
                          value={editFormData.city}
                          onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="form-label">Country</label>
                        <input
                          type="text"
                          value={editFormData.country}
                          onChange={(e) => setEditFormData({ ...editFormData, country: e.target.value })}
                          className="form-input"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Permanent Address</label>
                      <input
                        type="text"
                        value={editFormData.permanentAddress || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, permanentAddress: e.target.value })}
                        className="form-input"
                        placeholder="Hometown / permanent address"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <InfoRow label="Full Name" value={`${employee.firstName} ${employee.lastName}`} />
                    <InfoRow label="Father's Name" value={employee.fatherName} />
                    <InfoRow label="Email" value={employee.email} />
                    <InfoRow label="Phone" value={employee.phone} />
                    <InfoRow label="CNIC" value={employee.cnic} />
                    <InfoRow label="Date of Birth" value={employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : '-'} />
                    <InfoRow label="Gender" value={employee.gender} />
                    <InfoRow label="Blood Group" value={employee.bloodGroup} />
                    <InfoRow label="Current Address" value={[employee.address, employee.city, employee.country].filter(Boolean).join(', ')} />
                    <InfoRow label="Permanent Address" value={employee.permanentAddress} />
                  </>
                )}
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3 className="section-heading">Emergency Contact & Other Details</h3></div>
              <div className="card-body space-y-3">
                {editingTab === 'personal' && isEditMode ? (
                  <>
                    <div>
                      <label className="form-label">Emergency Contact Name</label>
                      <input
                        type="text"
                        value={editFormData.emergencyContactName}
                        onChange={(e) => setEditFormData({ ...editFormData, emergencyContactName: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Emergency Contact Phone</label>
                      <input
                        type="tel"
                        value={editFormData.emergencyContactPhone}
                        onChange={(e) => setEditFormData({ ...editFormData, emergencyContactPhone: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Emergency Contact Relation</label>
                      <input
                        type="text"
                        value={editFormData.emergencyContactRelation}
                        onChange={(e) => setEditFormData({ ...editFormData, emergencyContactRelation: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Marital Status</label>
                      <select
                        value={editFormData.maritalStatus || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, maritalStatus: e.target.value })}
                        className="form-select"
                      >
                        <option value="">Select Marital Status</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Nationality</label>
                      <input
                        type="text"
                        value={editFormData.nationality}
                        onChange={(e) => setEditFormData({ ...editFormData, nationality: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <InfoRow label="Emergency Contact Name" value={employee.emergencyContactName} />
                    <InfoRow label="Emergency Contact Phone" value={employee.emergencyContactPhone} />
                    <InfoRow label="Emergency Contact Relation" value={employee.emergencyContactRelation} />
                    <InfoRow label="Passport Expiry" value={employee.passportExpiry ? new Date(employee.passportExpiry).toLocaleDateString() : '-'} />
                    <InfoRow label="Marital Status" value={employee.maritalStatus} />
                    <InfoRow label="Nationality" value={employee.nationality} />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="card">
              <div className="card-header"><h3 className="section-heading">Background & Education</h3></div>
              <div className="card-body space-y-3">
                {editingTab === 'personal' && isEditMode ? (
                  <>
                    <div>
                      <label className="form-label">Last Degree</label>
                      <input
                        type="text"
                        value={editFormData.lastDegree || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, lastDegree: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Previous Organization</label>
                      <input
                        type="text"
                        value={editFormData.previousOrganization || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, previousOrganization: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Reference Check</label>
                      <input
                        type="text"
                        value={editFormData.referenceCheck || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, referenceCheck: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <InfoRow label="Last Degree" value={employee.lastDegree} />
                    <InfoRow label="Previous Organization" value={employee.previousOrganization} />
                    <InfoRow label="Reference Check" value={employee.referenceCheck} />
                  </>
                )}
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3 className="section-heading">Banking Details</h3></div>
              <div className="card-body space-y-3">
                <InfoRow label="Bank Name" value={employee.bankName} />
                <InfoRow label="Account Number" value={employee.bankAccountNumber} />
                <InfoRow label="Account Status" value={employee.bankAccountStatus} />
                <InfoRow label="Branch" value={employee.bankBranch} />
              </div>
            </div>
          </div>

          {/* Exit details — only for exited employees */}
          {employee.lifecycleStage === 'EXITED' && (
            <div className="card mt-6 border-l-4 border-red-400">
              <div className="card-header"><h3 className="section-heading">Exit Information</h3></div>
              <div className="card-body space-y-3">
                <InfoRow label="Date of Leaving" value={employee.dateOfLeaving ? new Date(employee.dateOfLeaving).toLocaleDateString() : '-'} />
                <InfoRow label="Exit Reason" value={employee.exitReason} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Employment Tab */}
      {activeTab === 'employment' && (
        <>
          <div className="mb-4 flex gap-2">
            {!isEditMode && editingTab !== 'employment' ? (
              <button
                onClick={() => {
                  setIsEditMode(true);
                  setEditingTab('employment');
                }}
                className="btn btn-primary"
                style={{ backgroundColor: '#0B1F3A' }}
              >
                Edit Employment
              </button>
            ) : editingTab === 'employment' ? (
              <>
                <button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ backgroundColor: '#0B1F3A' }}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setIsEditMode(false);
                    setEditingTab(null);
                  }}
                  className="btn"
                  style={{ backgroundColor: '#f0f0f0', color: '#333' }}
                >
                  Cancel
                </button>
              </>
            ) : null}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="card-header"><h3 className="section-heading">Employment Details</h3></div>
              <div className="card-body space-y-3">
                {editingTab === 'employment' && isEditMode ? (
                  <>
                    <div>
                      <label className="form-label">Department</label>
                      <select
                        value={editFormData.departmentId || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, departmentId: e.target.value ? parseInt(e.target.value) : null })}
                        className="form-select"
                      >
                        <option value="">Select Department</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Use this to move an employee between departments. The change is logged in the audit trail.
                      </p>
                    </div>
                    <div>
                      <label className="form-label">Sub-Companies</label>
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
                          const isChecked = (editFormData.companyIds || []).includes(c.id);
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
                                  const currentIds = editFormData.companyIds || [];
                                  setEditFormData({
                                    ...editFormData,
                                    companyIds: isChecked
                                      ? currentIds.filter((id: number) => id !== c.id)
                                      : [...currentIds, c.id],
                                  });
                                }}
                                style={{ accentColor: '#14B8A6', width: 14, height: 14 }}
                              />
                              {c.code} — {c.name}
                            </label>
                          );
                        })}
                      </div>
                      <p style={{ marginTop: 4, fontSize: '0.75rem', color: '#6B7280' }}>
                        Select one or more companies this employee works for
                      </p>
                    </div>
                    <div>
                      <label className="form-label">Location</label>
                      <select
                        value={editFormData.locationId || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, locationId: e.target.value ? parseInt(e.target.value) : null })}
                        className="form-select"
                      >
                        <option value="">Select Location</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Designation</label>
                      <input
                        type="text"
                        value={editFormData.designation || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Employment Status</label>
                      <select
                        value={editFormData.employmentStatus || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, employmentStatus: e.target.value })}
                        className="form-select"
                      >
                        <option value="PERMANENT">Permanent</option>
                        <option value="PROBATION">Probation</option>
                        <option value="CONSULTANT">Consultant</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Lifecycle Stage</label>
                      <select
                        value={editFormData.lifecycleStage || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, lifecycleStage: e.target.value })}
                        className="form-select"
                      >
                        <option value="OFFER_SENT">Offer Sent</option>
                        <option value="ONBOARDING">Onboarding</option>
                        <option value="PROVISIONING">Provisioning</option>
                        <option value="ACTIVE">Active</option>
                        <option value="EXIT_INITIATED">Exit Initiated</option>
                        <option value="EXITED">Exited</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        To officially exit an employee with a clearance checklist, use "Initiate Exit Process" instead.
                      </p>
                    </div>
                    <div>
                      <label className="form-label">Date of Joining</label>
                      <input
                        type="date"
                        value={editFormData.dateOfJoining || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, dateOfJoining: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Probation End Date</label>
                      <input
                        type="date"
                        value={editFormData.probationEndDate || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, probationEndDate: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Reporting Manager</label>
                      <select
                        value={editFormData.reportingManagerId || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, reportingManagerId: e.target.value ? parseInt(e.target.value) : null })}
                        className="form-select"
                      >
                        <option value="">None</option>
                        {allEmployees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.firstName} {emp.lastName} ({emp.empCode})
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <InfoRow label="Employee Code" value={employee.empCode} />
                    <InfoRow label="Department" value={employee.department.name} />
                    <InfoRow label="Team" value={getTeam(employee.empCode, employee.designation) || employee.team} />
                    <InfoRow
                      label="Companies"
                      value={
                        employeeCompanies.length > 0
                          ? employeeCompanies.map((c) => c.code || c.name).join(' · ')
                          : employee.company?.name || '—'
                      }
                    />
                    <InfoRow label="Location" value={employee.location?.name} />
                    <InfoRow label="Designation" value={employee.designation} />
                    <InfoRow label="Employment Status" value={employee.employmentStatus} />
                    <InfoRow label="Lifecycle Stage" value={employee.lifecycleStage.replace(/_/g, ' ')} />
                    <InfoRow label="Date of Joining" value={new Date(employee.dateOfJoining).toLocaleDateString()} />
                    {employee.probationEndDate && (
                      <InfoRow label="Probation End" value={new Date(employee.probationEndDate).toLocaleDateString()} />
                    )}
                    <InfoRow label="Reporting Manager" value={employee.reportingManager ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}` : '-'} />
                  </>
                )}
              </div>
            </div>

            {/* Actions, Direct Reports & Exit Clearance */}
            <div className="space-y-4">
              {/* Direct Reports */}
              <div className="card">
                <div className="card-header flex items-center justify-between">
                  <h3 className="section-heading">Direct Reports</h3>
                  <span className="badge badge-blue">{directReports.length}</span>
                </div>
                <div className="card-body">
                  {directReports.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-3">
                      No one currently reports to {employee.firstName}.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {directReports.map((r) => (
                        <Link
                          key={r.id}
                          href={`/employees/${r.id}`}
                          className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 transition-colors"
                        >
                          <div className="w-8 h-8 bg-brand-light rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-brand-primary">
                              {r.firstName[0]}{r.lastName[0]}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {r.firstName} {r.lastName}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {r.designation} &middot; {r.department?.name}
                            </div>
                          </div>
                          <span className="text-xs text-gray-400 font-mono">{r.empCode}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {employee.isActive && !employee.exitRecord && (
                <div className="card">
                  <div className="card-header"><h3 className="section-heading">Actions</h3></div>
                  <div className="card-body space-y-2">
                    <button
                      onClick={() => setShowExitModal(true)}
                      className="btn btn-danger w-full justify-center"
                    >
                      Initiate Exit Process
                    </button>
                  </div>
                </div>
              )}

              {employee.exitRecord && (
                <>
                  <div className="card border-red-200">
                    <div className="card-header bg-red-50"><h3 className="font-bold text-red-700">Exit Record</h3></div>
                    <div className="card-body space-y-3">
                      <InfoRow label="Exit Type" value={employee.exitRecord.exitType} />
                      <InfoRow label="Exit Date" value={new Date(employee.exitRecord.exitDate).toLocaleDateString()} />
                      <InfoRow label="Reason" value={employee.exitRecord.reason} />
                      <InfoRow label="Status" value={employee.exitRecord.isComplete ? 'Completed' : 'In Progress'} />
                    </div>
                  </div>

                  {/* Exit Clearance Checklist */}
                  <div className="card">
                    <div className="card-header"><h3 className="section-heading">Exit Clearance Checklist</h3></div>
                    <div className="card-body space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded hover:bg-gray-100">
                        <input
                          type="checkbox"
                          checked={clearanceStatus.assetsReturned}
                          onChange={() => handleClearanceToggle('assetsReturned')}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium">Assets Returned</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded hover:bg-gray-100">
                        <input
                          type="checkbox"
                          checked={clearanceStatus.digitalAccessRevoked}
                          onChange={() => handleClearanceToggle('digitalAccessRevoked')}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium">Digital Access Revoked</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded hover:bg-gray-100">
                        <input
                          type="checkbox"
                          checked={clearanceStatus.financialSettlement}
                          onChange={() => handleClearanceToggle('financialSettlement')}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium">Financial Settlement</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded hover:bg-gray-100">
                        <input
                          type="checkbox"
                          checked={clearanceStatus.documentsCollected}
                          onChange={() => handleClearanceToggle('documentsCollected')}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium">Documents Collected</span>
                      </label>

                      {!employee.exitRecord.isComplete && (
                        <button
                          onClick={handleCompleteExit}
                          disabled={!Object.values(clearanceStatus).every(Boolean) || loading}
                          className="btn w-full mt-4"
                          style={{
                            backgroundColor: Object.values(clearanceStatus).every(Boolean) ? '#00C853' : '#ccc',
                            color: 'white',
                            cursor: Object.values(clearanceStatus).every(Boolean) ? 'pointer' : 'not-allowed',
                          }}
                        >
                          {loading ? 'Completing...' : 'Complete Exit Process'}
                        </button>
                      )}

                      {employee.exitRecord.isComplete && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm text-center">
                          Exit process completed
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Onboarding Tab */}
      {activeTab === 'onboarding' && (
        <OnboardingChecklistPanel employeeId={employee.id} />
      )}

      {/* Assets Tab */}
      {activeTab === 'assets' && (
        <>
          {/* Asset summary strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="card">
              <div className="card-body">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Active</div>
                <div className="text-2xl font-bold text-gray-900">
                  {employee.assetAssignments.filter((a: any) => !a.returnedDate).length}
                </div>
                <div className="text-xs text-gray-500">Currently held</div>
              </div>
            </div>
            <div className="card">
              <div className="card-body">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Returned</div>
                <div className="text-2xl font-bold text-gray-900">
                  {employee.assetAssignments.filter((a: any) => a.returnedDate).length}
                </div>
                <div className="text-xs text-gray-500">Closed assignments</div>
              </div>
            </div>
            <div className="card">
              <div className="card-body">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Total Ever</div>
                <div className="text-2xl font-bold text-gray-900">
                  {employee.assetAssignments.length}
                </div>
                <div className="text-xs text-gray-500">Lifetime assignments</div>
              </div>
            </div>
            <div className="card">
              <div className="card-body">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Categories</div>
                <div className="text-2xl font-bold text-gray-900">
                  {new Set(
                    employee.assetAssignments
                      .filter((a: any) => !a.returnedDate)
                      .map((a: any) => a.asset?.category?.name)
                      .filter(Boolean)
                  ).size}
                </div>
                <div className="text-xs text-gray-500">Unique types active</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header flex justify-between items-center">
              <h3 className="section-heading">
                Assignment History ({employee.assetAssignments.filter((a: any) => !a.returnedDate).length} active)
              </h3>
              {employee.isActive && (
                <Link
                  href={`/assets?assignment=unassigned`}
                  className="btn btn-sm btn-primary"
                >
                  + Assign Asset
                </Link>
              )}
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Asset Tag</th>
                    <th>Category</th>
                    <th>Model</th>
                    <th>Assigned Date</th>
                    <th>Returned Date</th>
                    <th>Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.assetAssignments.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-500">No assets assigned</td></tr>
                  ) : (
                    employee.assetAssignments.map((a: any) => {
                      const start = new Date(a.assignedDate).getTime();
                      const end = a.returnedDate ? new Date(a.returnedDate).getTime() : Date.now();
                      const days = Math.max(1, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
                      return (
                        <tr key={a.id}>
                          <td className="font-mono text-sm">
                            <Link href={`/assets/${a.asset.id}`} className="text-brand-primary hover:underline">
                              {a.asset.assetTag}
                            </Link>
                          </td>
                          <td>{a.asset.category.name}</td>
                          <td>{a.asset.manufacturer} {a.asset.model}</td>
                          <td>{new Date(a.assignedDate).toLocaleDateString()}</td>
                          <td>{a.returnedDate ? new Date(a.returnedDate).toLocaleDateString() : '-'}</td>
                          <td className="text-sm text-gray-600">
                            {days >= 365 ? `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}m` : days >= 30 ? `${Math.floor(days / 30)}m` : `${days}d`}
                          </td>
                          <td>
                            <span className={`badge ${a.returnedDate ? 'badge-gray' : 'badge-green'}`}>
                              {a.returnedDate ? 'Returned' : 'Active'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Digital Access Tab */}
      {activeTab === 'digital' && (
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3 className="section-heading">Digital Access & Licenses</h3>
            <button onClick={() => setShowAccessModal(true)} className="btn btn-sm btn-primary">
              Grant Access
            </button>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Account ID</th>
                  <th>Granted Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employee.digitalAccess.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-500">No digital access records</td></tr>
                ) : (
                  employee.digitalAccess.map((da: any) => (
                    <tr key={da.id}>
                      <td className="font-semibold">{da.serviceName}</td>
                      <td>{da.accountId || '-'}</td>
                      <td>{new Date(da.grantedDate).toLocaleDateString()}</td>
                      <td>
                        <span className={`badge ${da.isActive ? 'badge-green' : 'badge-red'}`}>
                          {da.isActive ? 'Active' : 'Revoked'}
                        </span>
                      </td>
                      <td>
                        {da.isActive && (
                          <button
                            onClick={() => handleRevokeAccess(da.id)}
                            className="btn btn-sm btn-danger"
                          >
                            Revoke
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
      )}

      {/* Finance Tab */}
      {activeTab === 'finance' && (
        <>
          <div className="mb-4 flex gap-2">
            {!isEditMode && editingTab !== 'banking' ? (
              <button
                onClick={() => {
                  setIsEditMode(true);
                  setEditingTab('banking');
                }}
                className="btn btn-primary"
                style={{ backgroundColor: '#0B1F3A' }}
              >
                Edit Banking Details
              </button>
            ) : editingTab === 'banking' ? (
              <>
                <button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ backgroundColor: '#0B1F3A' }}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setIsEditMode(false);
                    setEditingTab(null);
                  }}
                  className="btn"
                  style={{ backgroundColor: '#f0f0f0', color: '#333' }}
                >
                  Cancel
                </button>
              </>
            ) : null}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="card-header"><h3 className="section-heading">Banking Details</h3></div>
              <div className="card-body space-y-3">
                {editingTab === 'banking' && isEditMode ? (
                  <>
                    <div>
                      <label className="form-label">Bank Name</label>
                      <input
                        type="text"
                        value={editFormData.bankName}
                        onChange={(e) => setEditFormData({ ...editFormData, bankName: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Account Number</label>
                      <input
                        type="text"
                        value={editFormData.bankAccountNumber}
                        onChange={(e) => setEditFormData({ ...editFormData, bankAccountNumber: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Branch</label>
                      <input
                        type="text"
                        value={editFormData.bankBranch}
                        onChange={(e) => setEditFormData({ ...editFormData, bankBranch: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Account Status</label>
                      <select
                        value={editFormData.bankAccountStatus || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, bankAccountStatus: e.target.value })}
                        className="form-select"
                      >
                        <option value="">Select Status</option>
                        <option value="Valid">Valid</option>
                        <option value="Invalid">Invalid</option>
                        <option value="Pending">Pending</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <InfoRow label="Bank Name" value={employee.bankName} />
                    <InfoRow label="Account Number" value={employee.bankAccountNumber} />
                    <InfoRow label="Account Status" value={employee.bankAccountStatus} />
                    <InfoRow label="Branch" value={employee.bankBranch} />
                  </>
                )}
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3 className="section-heading">Salary History</h3></div>
              <div className="card-body">
                {employee.salaryHistory.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No salary records yet</p>
                ) : (
                  <div className="space-y-3">
                    {employee.salaryHistory.map((s: any) => (
                      <div key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <div>
                          <div className="font-semibold">{s.currency} {Number(s.baseSalary).toLocaleString()}</div>
                          <div className="text-xs text-gray-500">
                            From {new Date(s.effectiveFrom).toLocaleDateString()}
                            {s.incrementPct && ` (+${s.incrementPct}%)`}
                          </div>
                        </div>
                        {s.reason && <span className="text-sm text-gray-600">{s.reason}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <DocumentsTab employee={employee} />
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="card">
          <div className="card-header">
            <h3 className="section-heading">Employee Activity Timeline</h3>
            <p className="text-sm text-gray-600 mt-1">Comprehensive activity feed from audit logs</p>
          </div>
          <div className="card-body">
            {timelineError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {timelineError}
              </div>
            )}

            {timelineLoading && timelineData.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-500">Loading timeline...</div>
              </div>
            ) : timelineData.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-500">No activity recorded yet</div>
              </div>
            ) : (
              <>
                <div className="space-y-6">
                  {timelineData.map((entry: any, index: number) => (
                    <TimelineEntryComponent
                      key={entry.id}
                      entry={entry}
                      isLast={index === timelineData.length - 1}
                    />
                  ))}
                </div>

                {timelineHasMore && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={handleLoadMoreTimeline}
                      disabled={timelineLoading}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
                    >
                      {timelineLoading ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Exit Modal */}
      <Modal
        isOpen={showExitModal}
        title="Initiate Employee Exit"
        onClose={() => setShowExitModal(false)}
        onSubmit={handleInitiateExit}
        submitLabel="Initiate Exit"
        submitDisabled={loading}
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Exit Type</label>
            <select
              value={exitData.exitType}
              onChange={(e) => setExitData({ ...exitData, exitType: e.target.value })}
              className="form-select"
            >
              <option value="RESIGNATION">Resignation</option>
              <option value="TERMINATION">Termination</option>
              <option value="CONTRACT_END">Contract End</option>
            </select>
          </div>
          <div>
            <label className="form-label">Exit Date</label>
            <input
              type="date"
              value={exitData.exitDate}
              onChange={(e) => setExitData({ ...exitData, exitDate: e.target.value })}
              className="form-input"
              required
            />
          </div>
          <div>
            <label className="form-label">Reason</label>
            <textarea
              value={exitData.reason}
              onChange={(e) => setExitData({ ...exitData, reason: e.target.value })}
              rows={3}
              className="form-textarea"
            />
          </div>
        </div>
      </Modal>

      {/* Grant Access Modal */}
      <Modal
        isOpen={showAccessModal}
        title="Grant Digital Access"
        onClose={() => setShowAccessModal(false)}
        onSubmit={handleGrantAccess}
        submitLabel="Grant Access"
        submitDisabled={loading}
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Service</label>
            <select
              value={accessData.serviceName}
              onChange={(e) => setAccessData({ ...accessData, serviceName: e.target.value })}
              className="form-select"
            >
              <option value="">Select Service</option>
              <option value="O365">Office 365</option>
              <option value="Claude">Claude AI</option>
              <option value="GitHub Copilot">GitHub Copilot</option>
              <option value="VPN">VPN</option>
              <option value="Biometric">Biometric</option>
              <option value="Slack">Slack</option>
              <option value="Jira">Jira</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="form-label">Account ID / Email</label>
            <input
              value={accessData.accountId}
              onChange={(e) => setAccessData({ ...accessData, accountId: e.target.value })}
              className="form-input"
              placeholder="e.g., user@99technologies.com"
            />
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea
              value={accessData.notes}
              onChange={(e) => setAccessData({ ...accessData, notes: e.target.value })}
              rows={2}
              className="form-textarea"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium">{value || '-'}</span>
    </div>
  );
}

function TimelineEntryComponent({
  entry,
  isLast,
}: {
  entry: any;
  isLast: boolean;
}) {
  const colorMap = {
    blue: { bg: 'bg-blue-100', dot: 'bg-blue-500', text: 'text-blue-700' },
    green: { bg: 'bg-green-100', dot: 'bg-green-500', text: 'text-green-700' },
    yellow: { bg: 'bg-yellow-100', dot: 'bg-yellow-500', text: 'text-yellow-700' },
    red: { bg: 'bg-red-100', dot: 'bg-red-500', text: 'text-red-700' },
    purple: { bg: 'bg-purple-100', dot: 'bg-purple-500', text: 'text-purple-700' },
    orange: { bg: 'bg-orange-100', dot: 'bg-orange-500', text: 'text-orange-700' },
  };

  const colors = colorMap[entry.color as keyof typeof colorMap] || colorMap.blue;
  const date = new Date(entry.date);
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center text-lg`}>
          {entry.icon}
        </div>
        {!isLast && <div className="w-0.5 h-20 bg-gray-200 mt-2" />}
      </div>
      <div className="pb-4 flex-grow">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-grow">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm">{entry.title}</h4>
              {entry.badge && (
                <span className={`text-xs px-2 py-1 rounded-full ${colors.bg} ${colors.text}`}>
                  {entry.badge}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-2">{entry.description}</p>
            <div className="flex gap-3 text-xs text-gray-500">
              <span>{dateStr}</span>
              <span>{timeStr}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Individual document upload slot
function DocumentSlot({
  docType,
  existingDoc,
  employeeId,
  onUploaded,
  onDeleted,
}: {
  docType: { value: string; label: string; accept: string; required: boolean };
  existingDoc: any | null;
  employeeId: number;
  onUploaded: (doc: any) => void;
  onDeleted: (docId: number) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowed = docType.accept.split(',').map(f => f.replace('.', ''));
    if (!ext || !allowed.includes(ext)) {
      setError(`Invalid format. Accepted: ${docType.accept.replace(/\./g, '').toUpperCase()}`);
      e.target.value = '';
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', docType.value);

      const response = await fetch(`/api/employees/${employeeId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const newDoc = await response.json();
      onUploaded(newDoc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async () => {
    if (!existingDoc || !confirm('Delete this document?')) return;
    try {
      const response = await fetch(`/api/employees/${employeeId}/documents/${existingDoc.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
      onDeleted(existingDoc.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${existingDoc ? 'border-green-200 bg-green-50/30' : docType.required ? 'border-red-200 bg-red-50/20' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {existingDoc ? (
            <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">{'\u2713'}</span>
          ) : (
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${docType.required ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400'}`}>
              {docType.required ? '!' : '?'}
            </span>
          )}
          <h4 className="text-sm font-semibold text-gray-800">{docType.label}</h4>
        </div>
        <span className="text-[10px] text-gray-400 font-mono">{docType.accept.replace(/\./g, '').toUpperCase()}</span>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {existingDoc ? (
        <div className="flex items-center justify-between bg-white rounded border border-gray-100 px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 truncate">{existingDoc.fileName}</p>
            <p className="text-[10px] text-gray-400">
              {new Date(existingDoc.uploadedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-1 ml-2 flex-shrink-0">
            <a
              href={existingDoc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 font-medium"
            >
              View
            </a>
            <button onClick={handleDelete} className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100 font-medium">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label className="block cursor-pointer">
          <div className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors ${uploading ? 'border-gray-200 bg-gray-50' : 'border-gray-300 hover:border-brand-primary hover:bg-brand-primary/5'}`}>
            {uploading ? (
              <p className="text-xs text-gray-500">Uploading...</p>
            ) : (
              <>
                <svg className="w-6 h-6 mx-auto text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-xs text-gray-500">Click to upload</p>
              </>
            )}
          </div>
          <input type="file" accept={docType.accept} onChange={handleFileChange} className="hidden" disabled={uploading} />
        </label>
      )}
    </div>
  );
}

// Documents Tab Component
function DocumentsTab({ employee }: { employee: any }) {
  const [documents, setDocuments] = useState(employee.documents || []);
  const router = useRouter();

  const DOCUMENT_TYPES = [
    { value: 'CNIC_FRONT', label: 'CNIC Front *', accept: '.pdf,.png,.jpg,.jpeg', required: true },
    { value: 'CNIC_BACK', label: 'CNIC Back *', accept: '.pdf,.png,.jpg,.jpeg', required: true },
    { value: 'PHOTO', label: 'Photo (Passport Size) *', accept: '.png,.jpg,.jpeg', required: true },
    { value: 'RESUME', label: 'Resume *', accept: '.pdf', required: true },
    { value: 'DEGREE', label: 'Degree', accept: '.pdf,.png,.jpg,.jpeg', required: false },
    { value: 'CONTRACT', label: 'Contract', accept: '.pdf,.png,.jpg,.jpeg', required: false },
    { value: 'NDA', label: 'NDA', accept: '.pdf,.png,.jpg,.jpeg', required: false },
    { value: 'OFFER_LETTER', label: 'Offer Letter', accept: '.pdf,.png,.jpg,.jpeg', required: false },
    { value: 'EXPERIENCE_LETTER', label: 'Experience Letter', accept: '.pdf,.png,.jpg,.jpeg', required: false },
    { value: 'OTHER', label: 'Other', accept: '.pdf,.png,.jpg,.jpeg', required: false },
  ];

  const requiredTypes = DOCUMENT_TYPES.filter(dt => dt.required);
  const optionalTypes = DOCUMENT_TYPES.filter(dt => !dt.required);
  const requiredUploaded = requiredTypes.filter(dt => documents.some((d: any) => d.documentType === dt.value)).length;

  const handleUploaded = (doc: any) => {
    setDocuments((prev: any[]) => [...prev, doc]);
    router.refresh();
  };

  const handleDeleted = (docId: number) => {
    setDocuments((prev: any[]) => prev.filter((d: any) => d.id !== docId));
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Required Documents */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h3 className="section-heading">Required Documents</h3>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${requiredUploaded === requiredTypes.length ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {requiredUploaded}/{requiredTypes.length} uploaded
          </span>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requiredTypes.map(dt => (
              <DocumentSlot
                key={dt.value}
                docType={dt}
                existingDoc={documents.find((d: any) => d.documentType === dt.value) || null}
                employeeId={employee.id}
                onUploaded={handleUploaded}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Optional Documents */}
      <div className="card">
        <div className="card-header">
          <h3 className="section-heading">Additional Documents</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {optionalTypes.map(dt => (
              <DocumentSlot
                key={dt.value}
                docType={dt}
                existingDoc={documents.find((d: any) => d.documentType === dt.value) || null}
                employeeId={employee.id}
                onUploaded={handleUploaded}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
