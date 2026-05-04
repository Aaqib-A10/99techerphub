'use client';

import Link from 'next/link';
import EmployeePicker from '@/app/components/EmployeePicker';
import { getTeam } from '../../client';

/**
 * Employment tab — biggest of the lot. Splits into two columns:
 *   Left  : Employment Details with edit-aware fields
 *   Right : Direct Reports list + Actions card + (if exited) Exit Record
 *           and Exit Clearance Checklist
 *
 * Shares the parent's edit state, exit-modal trigger, and clearance
 * checkbox state so save / exit-process / completion all run through the
 * same handlers as before.
 */

interface EmploymentEmployee {
  id: number;
  empCode: string;
  firstName: string;
  team: string | null;
  designation: string | null;
  dateOfJoining: Date | string;
  probationEndDate: Date | string | null;
  employmentStatus: string;
  lifecycleStage: string;
  department: { name: string };
  company?: { name: string } | null;
  location?: { name: string } | null;
  reportingManager?: { id: number; firstName: string; lastName: string } | null;
  isActive: boolean;
  exitRecord: {
    exitType: string;
    exitDate: Date | string;
    reason: string | null;
    isComplete: boolean;
  } | null;
}

interface DirectReport {
  id: number;
  firstName: string;
  lastName: string;
  empCode: string;
  designation: string;
  department: { name: string };
}

interface Lookup {
  id: number;
  code: string;
  name: string;
}

interface Location {
  id: number;
  name: string;
}

interface Props {
  employee: EmploymentEmployee;

  // shared edit state
  isEditMode: boolean;
  editingTab: string | null;
  editFormData: any;
  setEditFormData: (next: any) => void;
  loading: boolean;
  onEditClick: () => void;
  onSave: () => void;
  onCancel: () => void;

  // lookups
  departments: Lookup[];
  companies: Lookup[];
  locations: Location[];
  allEmployees: { id: number; firstName: string; lastName: string; empCode: string }[];
  employeeCompanies: Lookup[];

  // permissions / data
  canBrowseEmployees: boolean;
  directReports: DirectReport[];

  // exit flow
  onInitiateExitClick: () => void;
  clearanceStatus: any;
  onClearanceToggle: (key: 'assetsReturned' | 'digitalAccessRevoked' | 'financialSettlement' | 'documentsCollected') => void;
  onCompleteExit: () => void;
}

export default function EmploymentTab(props: Props) {
  const {
    employee,
    departments,
    companies,
    locations,
    allEmployees,
    employeeCompanies,
    canBrowseEmployees,
    directReports,
    clearanceStatus,
  } = props;

  const editing = props.editingTab === 'employment' && props.isEditMode;
  const f = props.editFormData;
  const setF = (patch: Record<string, any>) =>
    props.setEditFormData({ ...f, ...patch });

  return (
    <>
      <div className="mb-4 flex gap-2">
        {!props.isEditMode && props.editingTab !== 'employment' ? (
          <button
            onClick={props.onEditClick}
            className="btn btn-primary"
          >
            Edit Employment
          </button>
        ) : props.editingTab === 'employment' ? (
          <>
            <button
              onClick={props.onSave}
              disabled={props.loading}
              className="btn btn-primary"
            >
              {props.loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={props.onCancel}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Employment Details */}
        <div className="card">
          <div className="card-header">
            <h3 className="section-heading">Employment Details</h3>
          </div>
          <div className="card-body space-y-3">
            {editing ? (
              <>
                <div>
                  <label className="form-label">Department</label>
                  <select
                    value={f.departmentId || ''}
                    onChange={(e) =>
                      setF({ departmentId: e.target.value ? parseInt(e.target.value) : null })
                    }
                    className="form-select"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-core-text3">
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
                      const isChecked = (f.companyIds || []).includes(c.id);
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
                            backgroundColor: isChecked
                              ? 'rgba(11, 31, 58, 0.08)'
                              : 'transparent',
                            border: isChecked
                              ? '1px solid rgba(11, 31, 58, 0.2)'
                              : '1px solid #E5E7EB',
                            color: '#1F2320',
                            transition: 'all 0.15s',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const currentIds = f.companyIds || [];
                              setF({
                                companyIds: isChecked
                                  ? currentIds.filter((id: number) => id !== c.id)
                                  : [...currentIds, c.id],
                              });
                            }}
                            style={{ accentColor: '#8FBF3F', width: 14, height: 14 }}
                          />
                          {c.code} — {c.name}
                        </label>
                      );
                    })}
                  </div>
                  <p style={{ marginTop: 4, fontSize: '0.75rem', color: '#5A6159' }}>
                    Select one or more companies this employee works for
                  </p>
                </div>

                <div>
                  <label className="form-label">Location</label>
                  <select
                    value={f.locationId || ''}
                    onChange={(e) =>
                      setF({ locationId: e.target.value ? parseInt(e.target.value) : null })
                    }
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

                <Input
                  label="Designation"
                  value={f.designation || ''}
                  onChange={(v) => setF({ designation: v })}
                />
                <Select
                  label="Employment Status"
                  value={f.employmentStatus || ''}
                  onChange={(v) => setF({ employmentStatus: v })}
                  options={[
                    { value: 'PERMANENT', label: 'Permanent' },
                    { value: 'PROBATION', label: 'Probation' },
                    { value: 'CONSULTANT', label: 'Consultant' },
                  ]}
                />
                <div>
                  <Select
                    label="Lifecycle Stage"
                    value={f.lifecycleStage || ''}
                    onChange={(v) => setF({ lifecycleStage: v })}
                    options={[
                      { value: 'OFFER_SENT', label: 'Offer Sent' },
                      { value: 'ONBOARDING', label: 'Onboarding' },
                      { value: 'PROVISIONING', label: 'Provisioning' },
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'EXIT_INITIATED', label: 'Exit Initiated' },
                      { value: 'EXITED', label: 'Exited' },
                    ]}
                  />
                  <p className="mt-1 text-xs text-core-text3">
                    To officially exit an employee with a clearance checklist, use "Initiate Exit Process" instead.
                  </p>
                </div>
                <Input
                  label="Date of Joining"
                  type="date"
                  value={f.dateOfJoining || ''}
                  onChange={(v) => setF({ dateOfJoining: v })}
                />
                <Input
                  label="Probation End Date"
                  type="date"
                  value={f.probationEndDate || ''}
                  onChange={(v) => setF({ probationEndDate: v })}
                />
                <div>
                  <label className="form-label">Reporting Manager</label>
                  <EmployeePicker
                    employees={allEmployees}
                    value={f.reportingManagerId}
                    onChange={(id) => setF({ reportingManagerId: id })}
                    excludeIds={[employee.id]}
                    placeholder="Search by name, code, designation…"
                  />
                </div>
              </>
            ) : (
              <>
                <Row label="Employee Code" value={employee.empCode} />
                <Row label="Department" value={employee.department.name} />
                <Row
                  label="Team"
                  value={getTeam(employee.empCode, employee.designation ?? '') || employee.team}
                />
                <Row
                  label="Companies"
                  value={
                    employeeCompanies.length > 0
                      ? employeeCompanies.map((c) => c.code || c.name).join(' · ')
                      : employee.company?.name || '—'
                  }
                />
                <Row label="Location" value={employee.location?.name} />
                <Row label="Designation" value={employee.designation} />
                <Row label="Employment Status" value={employee.employmentStatus} />
                <Row
                  label="Lifecycle Stage"
                  value={employee.lifecycleStage.replace(/_/g, ' ')}
                />
                <Row
                  label="Date of Joining"
                  value={new Date(employee.dateOfJoining).toLocaleDateString()}
                />
                {employee.probationEndDate && (
                  <Row
                    label="Probation End"
                    value={new Date(employee.probationEndDate).toLocaleDateString()}
                  />
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-core-text3">Reporting Manager</span>
                  {employee.reportingManager ? (
                    canBrowseEmployees ? (
                      <Link
                        href={`/employees/${employee.reportingManager.id}`}
                        className="text-sm font-medium text-core-blueFg hover:text-core-blueFg hover:underline"
                      >
                        {employee.reportingManager.firstName}{' '}
                        {employee.reportingManager.lastName}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium">
                        {employee.reportingManager.firstName}{' '}
                        {employee.reportingManager.lastName}
                      </span>
                    )
                  ) : (
                    <span className="text-sm font-medium">-</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right column: Direct Reports + Actions + Exit */}
        <div className="space-y-4">
          {/* Direct Reports */}
          <div className="card" id="direct-reports">
            <div className="card-header flex items-center justify-between">
              <h3 className="section-heading">Direct Reports</h3>
              <span className="badge badge-blue">{directReports.length}</span>
            </div>
            <div className="card-body">
              {directReports.length === 0 ? (
                <p className="text-sm text-core-text3 text-center py-3">
                  No one currently reports to {employee.firstName}.
                </p>
              ) : (
                <div className="space-y-2">
                  {directReports.map((r) => {
                    const RowTag: any = canBrowseEmployees ? Link : 'div';
                    const rowProps = canBrowseEmployees
                      ? { href: `/employees/${r.id}` }
                      : {};
                    return (
                      <RowTag
                        key={r.id}
                        {...rowProps}
                        className={`flex items-center gap-3 p-2 rounded transition-colors ${
                          canBrowseEmployees ? 'hover:bg-core-surface2' : ''
                        }`}
                      >
                        <div className="w-8 h-8 bg-core-greenSoft rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-core-text2">
                            {r.firstName[0]}
                            {r.lastName[0]}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-core-text truncate">
                            {r.firstName} {r.lastName}
                          </div>
                          <div className="text-xs text-core-text3 truncate">
                            {r.designation} · {r.department?.name}
                          </div>
                        </div>
                        <span className="text-xs text-core-text3 font-mono">{r.empCode}</span>
                      </RowTag>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Actions (active only) */}
          {employee.isActive && !employee.exitRecord && (
            <div className="card">
              <div className="card-header">
                <h3 className="section-heading">Actions</h3>
              </div>
              <div className="card-body space-y-2">
                <button
                  onClick={props.onInitiateExitClick}
                  className="btn btn-danger w-full justify-center"
                >
                  Initiate Exit Process
                </button>
              </div>
            </div>
          )}

          {/* Exit Record + Clearance Checklist (exited only) */}
          {employee.exitRecord && (
            <>
              <div className="card border-core-border">
                <div className="card-header bg-core-roseSoft">
                  <h3 className="font-bold text-core-roseFg">Exit Record</h3>
                </div>
                <div className="card-body space-y-3">
                  <Row label="Exit Type" value={employee.exitRecord.exitType} />
                  <Row
                    label="Exit Date"
                    value={new Date(employee.exitRecord.exitDate).toLocaleDateString()}
                  />
                  <Row label="Reason" value={employee.exitRecord.reason} />
                  <Row
                    label="Status"
                    value={employee.exitRecord.isComplete ? 'Completed' : 'In Progress'}
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="section-heading">Exit Clearance Checklist</h3>
                </div>
                <div className="card-body space-y-3">
                  <ClearanceItem
                    label="Assets Returned"
                    checked={!!clearanceStatus.assetsReturned}
                    onToggle={() => props.onClearanceToggle('assetsReturned')}
                  />
                  <ClearanceItem
                    label="Digital Access Revoked"
                    checked={!!clearanceStatus.digitalAccessRevoked}
                    onToggle={() => props.onClearanceToggle('digitalAccessRevoked')}
                  />
                  <ClearanceItem
                    label="Financial Settlement"
                    checked={!!clearanceStatus.financialSettlement}
                    onToggle={() => props.onClearanceToggle('financialSettlement')}
                  />
                  <ClearanceItem
                    label="Documents Collected"
                    checked={!!clearanceStatus.documentsCollected}
                    onToggle={() => props.onClearanceToggle('documentsCollected')}
                  />

                  {!employee.exitRecord.isComplete && (
                    <button
                      onClick={props.onCompleteExit}
                      disabled={
                        !Object.values(clearanceStatus).every(Boolean) || props.loading
                      }
                      className="btn w-full mt-4"
                      style={{
                        backgroundColor: Object.values(clearanceStatus).every(Boolean)
                          ? '#8FBF3F'
                          : '#ccc',
                        color: 'white',
                        cursor: Object.values(clearanceStatus).every(Boolean)
                          ? 'pointer'
                          : 'not-allowed',
                      }}
                    >
                      {props.loading ? 'Completing...' : 'Complete Exit Process'}
                    </button>
                  )}

                  {employee.exitRecord.isComplete && (
                    <div className="p-3 bg-core-greenSoft border border-core-border rounded text-core-greenFg text-sm text-center">
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
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="form-input"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="form-select"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-core-text3">{label}</span>
      <span className="text-sm font-medium">{value || '-'}</span>
    </div>
  );
}

function ClearanceItem({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer p-3 bg-core-surface2 rounded hover:bg-core-surface2">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="w-4 h-4"
      />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}
