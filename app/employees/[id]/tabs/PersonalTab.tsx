'use client';

/**
 * Personal tab — identity, emergency contact, education, banking summary,
 * and the exit info card for departed employees.
 *
 * Edit-aware: shares isEditMode + editFormData with the parent so the Save
 * Changes button at the top fires the same handleSaveProfile that other
 * tabs use. Banking shown read-only here (full edit lives in Finance tab).
 */

interface PersonalEmployee {
  firstName: string;
  lastName: string;
  fatherName: string | null;
  email: string | null;
  workEmail: string | null;
  phone: string | null;
  cnic: string | null;
  dateOfBirth: Date | string | null;
  gender: string | null;
  bloodGroup: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  permanentAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  passportNumber: string | null;
  passportExpiry: Date | string | null;
  maritalStatus: string | null;
  nationality: string | null;
  lastDegree: string | null;
  previousOrganization: string | null;
  referenceCheck: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountStatus: string | null;
  bankBranch: string | null;
  lifecycleStage: string;
  dateOfLeaving: Date | string | null;
  exitReason: string | null;
}

interface Props {
  employee: PersonalEmployee;
  isEditMode: boolean;
  editingTab: string | null;
  editFormData: any;
  setEditFormData: (next: any) => void;
  loading: boolean;
  onEditClick: () => void;
  onSave: () => void;
  onCancel: () => void;
}

function formatCnic(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export default function PersonalTab(props: Props) {
  const { employee } = props;
  const editing = props.editingTab === 'personal' && props.isEditMode;
  const f = props.editFormData;
  const setF = (patch: Record<string, any>) =>
    props.setEditFormData({ ...f, ...patch });

  return (
    <>
      <div className="mb-4 flex gap-2">
        {!props.isEditMode ? (
          <button
            onClick={props.onEditClick}
            className="btn btn-primary"
            style={{ backgroundColor: '#0B1F3A' }}
          >
            Edit Profile
          </button>
        ) : (
          <>
            <button
              onClick={props.onSave}
              disabled={props.loading}
              className="btn btn-primary"
              style={{ backgroundColor: '#0B1F3A' }}
            >
              {props.loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={props.onCancel}
              className="btn"
              style={{ backgroundColor: '#f0f0f0', color: '#333' }}
            >
              Cancel
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Details */}
        <div className="card">
          <div className="card-header">
            <h3 className="section-heading">Personal Details</h3>
          </div>
          <div className="card-body space-y-3">
            {editing ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="First Name" value={f.firstName} onChange={(v) => setF({ firstName: v })} />
                  <Input label="Last Name" value={f.lastName} onChange={(v) => setF({ lastName: v })} />
                </div>
                <Input label="Father's Name" value={f.fatherName} onChange={(v) => setF({ fatherName: v })} />
                <Input
                  label="Personal Email"
                  type="email"
                  value={f.email || ''}
                  onChange={(v) => setF({ email: v })}
                  placeholder="personal@gmail.com"
                />
                <div>
                  <label className="form-label">Organization Email</label>
                  <input
                    type="email"
                    value={f.workEmail || ''}
                    onChange={(e) => setF({ workEmail: e.target.value })}
                    className="form-input"
                    placeholder="name@99technologies.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">Used for Google/Microsoft SSO</p>
                </div>
                <Input label="Phone" type="tel" value={f.phone} onChange={(v) => setF({ phone: v })} />
                <Input
                  label="CNIC"
                  value={f.cnic || ''}
                  onChange={(v) => setF({ cnic: formatCnic(v) })}
                  placeholder="XXXXX-XXXXXXX-X"
                  maxLength={15}
                />
                <Input
                  label="Date of Birth"
                  type="date"
                  value={f.dateOfBirth}
                  onChange={(v) => setF({ dateOfBirth: v })}
                />
                <Select
                  label="Gender"
                  value={f.gender || ''}
                  onChange={(v) => setF({ gender: v })}
                  options={[
                    { value: '', label: 'Select Gender' },
                    { value: 'Male', label: 'Male' },
                    { value: 'Female', label: 'Female' },
                    { value: 'Other', label: 'Other' },
                  ]}
                />
                <Select
                  label="Blood Group"
                  value={f.bloodGroup || ''}
                  onChange={(v) => setF({ bloodGroup: v })}
                  options={[
                    { value: '', label: 'Select Blood Group' },
                    ...['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((g) => ({ value: g, label: g })),
                  ]}
                />
                <Input label="Address" value={f.address} onChange={(v) => setF({ address: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="City" value={f.city} onChange={(v) => setF({ city: v })} />
                  <Input label="Country" value={f.country} onChange={(v) => setF({ country: v })} />
                </div>
                <Input
                  label="Permanent Address"
                  value={f.permanentAddress || ''}
                  onChange={(v) => setF({ permanentAddress: v })}
                  placeholder="Hometown / permanent address"
                />
              </>
            ) : (
              <>
                <Row label="Full Name" value={`${employee.firstName} ${employee.lastName}`} />
                <Row label="Father's Name" value={employee.fatherName} />
                <Row label="Personal Email" value={employee.email} />
                <Row label="Organization Email" value={employee.workEmail} />
                <Row label="Phone" value={employee.phone} />
                <Row label="CNIC" value={employee.cnic} />
                <Row
                  label="Date of Birth"
                  value={employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : '-'}
                />
                <Row label="Gender" value={employee.gender} />
                <Row label="Blood Group" value={employee.bloodGroup} />
                <Row label="Current Address" value={employee.address} />
                <Row label="City" value={employee.city} />
                <Row label="Country" value={employee.country} />
                <Row label="Permanent Address" value={employee.permanentAddress} />
              </>
            )}
          </div>
        </div>

        {/* Emergency Contact & Other Details */}
        <div className="card">
          <div className="card-header">
            <h3 className="section-heading">Emergency Contact & Other Details</h3>
          </div>
          <div className="card-body space-y-3">
            {editing ? (
              <>
                <Input
                  label="Emergency Contact Name"
                  value={f.emergencyContactName}
                  onChange={(v) => setF({ emergencyContactName: v })}
                />
                <Input
                  label="Emergency Contact Phone"
                  type="tel"
                  value={f.emergencyContactPhone}
                  onChange={(v) => setF({ emergencyContactPhone: v })}
                />
                <Input
                  label="Emergency Contact Relation"
                  value={f.emergencyContactRelation}
                  onChange={(v) => setF({ emergencyContactRelation: v })}
                />
                <Select
                  label="Marital Status"
                  value={f.maritalStatus || ''}
                  onChange={(v) => setF({ maritalStatus: v })}
                  options={[
                    { value: '', label: 'Select Marital Status' },
                    { value: 'Single', label: 'Single' },
                    { value: 'Married', label: 'Married' },
                    { value: 'Divorced', label: 'Divorced' },
                    { value: 'Widowed', label: 'Widowed' },
                  ]}
                />
                <Input
                  label="Nationality"
                  value={f.nationality}
                  onChange={(v) => setF({ nationality: v })}
                />
              </>
            ) : (
              <>
                <Row label="Emergency Contact Name" value={employee.emergencyContactName} />
                <Row label="Emergency Contact Phone" value={employee.emergencyContactPhone} />
                <Row label="Emergency Contact Relation" value={employee.emergencyContactRelation} />
                <Row label="Passport Number" value={employee.passportNumber} />
                <Row
                  label="Passport Expiry"
                  value={
                    employee.passportExpiry
                      ? new Date(employee.passportExpiry).toLocaleDateString()
                      : '-'
                  }
                />
                <Row label="Marital Status" value={employee.maritalStatus} />
                <Row label="Nationality" value={employee.nationality} />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Background & Education */}
        <div className="card">
          <div className="card-header">
            <h3 className="section-heading">Background & Education</h3>
          </div>
          <div className="card-body space-y-3">
            {editing ? (
              <>
                <Input
                  label="Last Degree"
                  value={f.lastDegree || ''}
                  onChange={(v) => setF({ lastDegree: v })}
                />
                <Input
                  label="Previous Organization"
                  value={f.previousOrganization || ''}
                  onChange={(v) => setF({ previousOrganization: v })}
                />
                <Input
                  label="Reference Check"
                  value={f.referenceCheck || ''}
                  onChange={(v) => setF({ referenceCheck: v })}
                />
              </>
            ) : (
              <>
                <Row label="Last Degree" value={employee.lastDegree} />
                <Row label="Previous Organization" value={employee.previousOrganization} />
                <Row label="Reference Check" value={employee.referenceCheck} />
              </>
            )}
          </div>
        </div>

        {/* Banking summary (full edit lives in Finance tab) */}
        <div className="card">
          <div className="card-header">
            <h3 className="section-heading">Banking Details</h3>
          </div>
          <div className="card-body space-y-3">
            <Row label="Bank Name" value={employee.bankName} />
            <Row label="Account Number" value={employee.bankAccountNumber} />
            <Row label="Account Status" value={employee.bankAccountStatus} />
            <Row label="Branch" value={employee.bankBranch} />
          </div>
        </div>
      </div>

      {/* Exit details — only for exited employees */}
      {employee.lifecycleStage === 'EXITED' && (
        <div className="card mt-6 border-l-4 border-red-400">
          <div className="card-header">
            <h3 className="section-heading">Exit Information</h3>
          </div>
          <div className="card-body space-y-3">
            <Row
              label="Date of Leaving"
              value={
                employee.dateOfLeaving
                  ? new Date(employee.dateOfLeaving).toLocaleDateString()
                  : '-'
              }
            />
            <Row label="Exit Reason" value={employee.exitReason} />
          </div>
        </div>
      )}
    </>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="form-input"
        placeholder={placeholder}
        maxLength={maxLength}
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
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium">{value || '-'}</span>
    </div>
  );
}
