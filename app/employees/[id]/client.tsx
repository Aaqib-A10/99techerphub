'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import OnboardingChecklistPanel from './OnboardingChecklistPanel';
import EmployeePicker from '@/app/components/EmployeePicker';
import RolesEditor from './RolesEditor';
import AssetsTab from './tabs/AssetsTab';
import DigitalAccessTab from './tabs/DigitalAccessTab';
import EmploymentTab from './tabs/EmploymentTab';
import FinanceTab from './tabs/FinanceTab';
import PersonalTab from './tabs/PersonalTab';
import type { EmployeeWithRelations } from './types';
import { getTeam } from '../client';

function formatCnic(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

interface EmployeeDetailClientProps {
  /** Server-component payload — see `employeeDetailInclude` in types.ts. */
  employee: EmployeeWithRelations;
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
  /** Whether the signed-in viewer is allowed to navigate into other employee
   *  profiles (Reports To, Direct Reports list). EMPLOYEE = false. */
  canBrowseEmployees: boolean;
  /** Whether the viewer can grant digital access on this employee's behalf —
   *  ADMIN/HR only. Everyone else is routed to /access-catalog to request. */
  canGrantAccess: boolean;
  rolesProps: {
    responsibilities: string | null;
    marketplaceIds: number[];
    marketplaceCatalog: { id: number; name: string }[];
    canEdit: boolean;
  };
}

export default function EmployeeDetailClient({
  employee,
  allEmployees,
  departments = [],
  companies = [],
  locations = [],
  directReports = [],
  employeeCompanies = [],
  canBrowseEmployees,
  canGrantAccess,
  rolesProps,
}: EmployeeDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('personal');

  // Hash-based deep links: e.g. /employees/123#documents lands on the
  // Documents tab; /employees/123#direct-reports lands on Employment and
  // scrolls to the Direct Reports panel.
  useEffect(() => {
    const VALID_TAB_HASHES = new Set([
      'personal', 'employment', 'roles', 'onboarding', 'assets',
      'digital', 'finance', 'documents', 'timeline',
    ]);
    function handleHash() {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'direct-reports') {
        setActiveTab('employment');
        setTimeout(() => {
          document.getElementById('direct-reports')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
      } else if (VALID_TAB_HASHES.has(hash)) {
        setActiveTab(hash);
      }
    }
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);
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

  // Build the edit-form snapshot from the canonical employee prop. Used to
  // initialize state AND to revert on Cancel — without this, clicking Cancel
  // after editing would keep the user's unsaved (possibly cleared) values in
  // state, so re-opening Edit showed the cleared field as if it were the
  // current value.
  const buildInitialEditFormData = () => ({
    // Personal
    firstName: employee.firstName,
    lastName: employee.lastName,
    fatherName: employee.fatherName,
    email: employee.email,
    workEmail: employee.workEmail,
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

  const [editFormData, setEditFormData] = useState<any>(buildInitialEditFormData);

  const cancelEdit = () => {
    setEditFormData(buildInitialEditFormData());
    setIsEditMode(false);
    setEditingTab(null);
  };

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
    { id: 'roles', label: 'Responsibility' },
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
        <div className="mb-4 p-3 bg-core-roseSoft border border-red-400 text-core-roseFg rounded flex items-start justify-between gap-3">
          <span className="text-sm">{error}</span>
          <button
            onClick={() => setError('')}
            className="text-core-roseFg hover:text-core-roseFg text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      {successMsg && (
        <div className="mb-4 p-3 bg-core-greenSoft border border-core-border text-core-greenFg rounded flex items-start justify-between gap-3">
          <span className="text-sm">✓ {successMsg}</span>
          <button
            onClick={() => setSuccessMsg('')}
            className="text-core-greenFg hover:text-core-greenFg text-lg leading-none"
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
        <PersonalTab
          employee={employee as any}
          isEditMode={isEditMode}
          editingTab={editingTab}
          editFormData={editFormData}
          setEditFormData={setEditFormData}
          loading={loading}
          onEditClick={() => {
            setIsEditMode(true);
            setEditingTab('personal');
          }}
          onSave={handleSaveProfile}
          onCancel={cancelEdit}
        />
      )}


      {/* Employment Tab */}
      {activeTab === 'employment' && (
        <EmploymentTab
          employee={employee as any}
          isEditMode={isEditMode}
          editingTab={editingTab}
          editFormData={editFormData}
          setEditFormData={setEditFormData}
          loading={loading}
          onEditClick={() => {
            setIsEditMode(true);
            setEditingTab('employment');
          }}
          onSave={handleSaveProfile}
          onCancel={cancelEdit}
          departments={departments}
          companies={companies}
          locations={locations}
          allEmployees={allEmployees}
          employeeCompanies={employeeCompanies}
          canBrowseEmployees={canBrowseEmployees}
          directReports={directReports}
          onInitiateExitClick={() => setShowExitModal(true)}
          clearanceStatus={clearanceStatus}
          onClearanceToggle={handleClearanceToggle}
          onCompleteExit={handleCompleteExit}
        />
      )}


      {/* Roles & Responsibilities Tab */}
      {activeTab === 'roles' && (
        <RolesEditor
          employeeId={employee.id}
          initialResponsibilities={rolesProps.responsibilities}
          initialMarketplaceIds={rolesProps.marketplaceIds}
          marketplaceOptions={rolesProps.marketplaceCatalog}
          canEdit={rolesProps.canEdit}
        />
      )}

      {/* Onboarding Tab */}
      {activeTab === 'onboarding' && (
        <OnboardingChecklistPanel employeeId={employee.id} />
      )}

      {/* Assets Tab */}
      {activeTab === 'assets' && (
        <AssetsTab
          assetAssignments={employee.assetAssignments as any}
          isActive={employee.isActive}
        />
      )}

      {/* Digital Access Tab */}
      {activeTab === 'digital' && (
        <DigitalAccessTab
          digitalAccess={employee.digitalAccess}
          onGrantClick={() => setShowAccessModal(true)}
          onRevoke={handleRevokeAccess}
          canGrant={canGrantAccess}
        />
      )}

      {/* Finance Tab */}
      {activeTab === 'finance' && (
        <FinanceTab
          employee={employee as any}
          isEditMode={isEditMode}
          editingTab={editingTab}
          editFormData={editFormData}
          setEditFormData={setEditFormData}
          loading={loading}
          onEditClick={() => {
            setIsEditMode(true);
            setEditingTab('banking');
          }}
          onSave={handleSaveProfile}
          onCancel={cancelEdit}
        />
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
            <p className="text-sm text-core-text2 mt-1">Comprehensive activity feed from audit logs</p>
          </div>
          <div className="card-body">
            {timelineError && (
              <div className="mb-4 p-3 bg-core-roseSoft border border-red-400 text-core-roseFg rounded">
                {timelineError}
              </div>
            )}

            {timelineLoading && timelineData.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-core-text3">Loading timeline...</div>
              </div>
            ) : timelineData.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-core-text3">No activity recorded yet</div>
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
                      className="px-4 py-2 bg-core-border text-core-text rounded hover:bg-core-border disabled:opacity-50"
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
      <span className="text-sm text-core-text3">{label}</span>
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
    blue: { bg: 'bg-core-blueSoft', dot: 'bg-blue-500', text: 'text-core-blueFg' },
    green: { bg: 'bg-core-greenSoft', dot: 'bg-green-500', text: 'text-core-greenFg' },
    yellow: { bg: 'bg-core-amberSoft', dot: 'bg-yellow-500', text: 'text-core-amberFg' },
    red: { bg: 'bg-core-roseSoft', dot: 'bg-red-500', text: 'text-core-roseFg' },
    purple: { bg: 'bg-core-violetSoft', dot: 'bg-purple-500', text: 'text-core-violetFg' },
    orange: { bg: 'bg-core-amberSoft', dot: 'bg-orange-500', text: 'text-core-amberFg' },
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
        {!isLast && <div className="w-0.5 h-20 bg-core-border mt-2" />}
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
            <p className="text-sm text-core-text2 mb-2">{entry.description}</p>
            <div className="flex gap-3 text-xs text-core-text3">
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
  const [isDragging, setIsDragging] = useState(false);

  const uploadFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowed = docType.accept.split(',').map(f => f.replace('.', ''));
    if (!ext || !allowed.includes(ext)) {
      setError(`Invalid format. Accepted: ${docType.accept.replace(/\./g, '').toUpperCase()}`);
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
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); if (!uploading) setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (e.dataTransfer.files.length > 1) {
      setError('Drop one file at a time for this slot');
      return;
    }
    await uploadFile(file);
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
    <div className={`border rounded-lg p-4 ${existingDoc ? 'border-core-border bg-core-greenSoft/30' : docType.required ? 'border-core-border bg-core-roseSoft/20' : 'border-core-border'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {existingDoc ? (
            <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">{'\u2713'}</span>
          ) : (
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${docType.required ? 'bg-core-roseSoft text-core-roseFg' : 'bg-core-surface2 text-core-text3'}`}>
              {docType.required ? '!' : '?'}
            </span>
          )}
          <h4 className="text-sm font-semibold text-core-text">{docType.label}</h4>
        </div>
        <span className="text-[10px] text-core-text3 font-mono">{docType.accept.replace(/\./g, '').toUpperCase()}</span>
      </div>

      {error && <p className="text-xs text-core-roseFg mb-2">{error}</p>}

      {existingDoc ? (
        <div className="flex items-center justify-between bg-core-surface rounded border border-core-border px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-core-text2 truncate">{existingDoc.fileName}</p>
            <p className="text-[10px] text-core-text3">
              {new Date(existingDoc.uploadedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-1 ml-2 flex-shrink-0">
            <a
              href={existingDoc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 bg-core-blueSoft text-core-blueFg rounded text-xs hover:bg-core-blueSoft font-medium"
            >
              View
            </a>
            <button onClick={handleDelete} className="px-2 py-1 bg-core-roseSoft text-core-roseFg rounded text-xs hover:bg-core-roseSoft font-medium">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label
          className="block cursor-pointer"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors ${uploading ? 'border-core-border bg-core-surface2' : isDragging ? 'border-core-text bg-core-text/10' : 'border-core-border hover:border-core-text hover:bg-core-text/5'}`}>
            {uploading ? (
              <p className="text-xs text-core-text3">Uploading...</p>
            ) : (
              <>
                <svg className="w-6 h-6 mx-auto text-core-text3 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-xs text-core-text3">{isDragging ? 'Drop file here' : 'Drag & drop, or click to upload'}</p>
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
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${requiredUploaded === requiredTypes.length ? 'bg-core-greenSoft text-core-greenFg' : 'bg-core-amberSoft text-core-amberFg'}`}>
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
