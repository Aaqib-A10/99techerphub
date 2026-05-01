'use client';

/**
 * Finance tab — banking details (edit-aware), salary history, commissions,
 * deductions, billing splits.
 *
 * The banking edit form shares the parent's editFormData / isEditMode state
 * (so the Save Changes button at the top of the tab works through the same
 * handleSaveProfile that other edit-mode tabs use). The read-only sections
 * (salary, commissions, deductions, billing) just render `employee.*` data.
 */

interface SalaryHistoryRow {
  id: number;
  baseSalary: any;
  currency: string;
  effectiveFrom: Date | string;
  incrementPct: any;
  reason: string | null;
}

interface CommissionRow {
  id: number;
  amount: any;
  currency: string;
  description: string | null;
  period: string;
  isPaid: boolean;
}

interface DeductionRow {
  id: number;
  amount: any;
  currency: string;
  description: string | null;
  deductionType: string;
  period: string;
}

interface BillingSplitRow {
  id: number;
  companyId: number;
  company?: { id: number; name: string; code: string } | null;
  effectiveFrom: Date | string;
  effectiveTo: Date | string | null;
  percentage: any;
}

interface Props {
  employee: {
    id: number;
    bankName: string | null;
    bankAccountNumber: string | null;
    bankBranch: string | null;
    bankAccountStatus: string | null;
    salaryHistory: SalaryHistoryRow[];
    commissions: CommissionRow[];
    deductions: DeductionRow[];
    billingSplits: BillingSplitRow[];
  };
  // shared edit state from parent
  isEditMode: boolean;
  editingTab: string | null;
  editFormData: any;
  setEditFormData: (next: any) => void;
  loading: boolean;
  onEditClick: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function FinanceTab(props: Props) {
  const { employee } = props;
  const isBankingEdit = props.editingTab === 'banking' && props.isEditMode;

  return (
    <>
      <div className="mb-4 flex gap-2">
        {!props.isEditMode && props.editingTab !== 'banking' ? (
          <button
            onClick={props.onEditClick}
            className="btn btn-primary"
            style={{ backgroundColor: '#0B1F3A' }}
          >
            Edit Banking Details
          </button>
        ) : props.editingTab === 'banking' ? (
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
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Banking */}
        <div className="card">
          <div className="card-header">
            <h3 className="section-heading">Banking Details</h3>
          </div>
          <div className="card-body space-y-3">
            {isBankingEdit ? (
              <>
                <BankInput
                  label="Bank Name"
                  value={props.editFormData.bankName}
                  onChange={(v) =>
                    props.setEditFormData({ ...props.editFormData, bankName: v })
                  }
                />
                <BankInput
                  label="Account Number"
                  value={props.editFormData.bankAccountNumber}
                  onChange={(v) =>
                    props.setEditFormData({ ...props.editFormData, bankAccountNumber: v })
                  }
                />
                <BankInput
                  label="Branch"
                  value={props.editFormData.bankBranch}
                  onChange={(v) =>
                    props.setEditFormData({ ...props.editFormData, bankBranch: v })
                  }
                />
                <div>
                  <label className="form-label">Account Status</label>
                  <select
                    value={props.editFormData.bankAccountStatus || ''}
                    onChange={(e) =>
                      props.setEditFormData({
                        ...props.editFormData,
                        bankAccountStatus: e.target.value,
                      })
                    }
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
                <Row label="Bank Name" value={employee.bankName} />
                <Row label="Account Number" value={employee.bankAccountNumber} />
                <Row label="Account Status" value={employee.bankAccountStatus} />
                <Row label="Branch" value={employee.bankBranch} />
              </>
            )}
          </div>
        </div>

        {/* Salary History */}
        <div className="card">
          <div className="card-header">
            <h3 className="section-heading">Salary History</h3>
          </div>
          <div className="card-body">
            {employee.salaryHistory.length === 0 ? (
              <p className="text-core-text3 text-center py-4">No salary records yet</p>
            ) : (
              <div className="space-y-3">
                {employee.salaryHistory.map((s) => (
                  <div
                    key={s.id}
                    className="flex justify-between items-center p-3 bg-core-surface2 rounded"
                  >
                    <div>
                      <div className="font-semibold">
                        {s.currency} {Number(s.baseSalary).toLocaleString()}
                      </div>
                      <div className="text-xs text-core-text3">
                        From {new Date(s.effectiveFrom).toLocaleDateString()}
                        {s.incrementPct && ` (+${s.incrementPct}%)`}
                      </div>
                    </div>
                    {s.reason && (
                      <span className="text-sm text-core-text2">{s.reason}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Commissions */}
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3 className="section-heading">Commissions</h3>
            <a
              href={`/finance/commissions?employeeId=${employee.id}`}
              className="text-xs text-core-blueFg hover:underline"
            >
              Manage
            </a>
          </div>
          <div className="card-body">
            {(!employee.commissions || employee.commissions.length === 0) ? (
              <p className="text-core-text3 text-center py-4">No commissions recorded</p>
            ) : (
              <div className="space-y-3">
                {employee.commissions.map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-between items-start p-3 bg-core-surface2 rounded"
                  >
                    <div>
                      <div className="font-semibold">
                        {c.currency} {Number(c.amount).toLocaleString()}
                      </div>
                      <div className="text-xs text-core-text3">{c.description}</div>
                      <div className="text-xs text-core-text3 mt-0.5">Period: {c.period}</div>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        c.isPaid
                          ? 'bg-core-greenSoft text-core-greenFg'
                          : 'bg-core-amberSoft text-core-amberFg'
                      }`}
                    >
                      {c.isPaid ? 'PAID' : 'UNPAID'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Deductions */}
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3 className="section-heading">Deductions</h3>
            <a
              href={`/finance/deductions?employeeId=${employee.id}`}
              className="text-xs text-core-blueFg hover:underline"
            >
              Manage
            </a>
          </div>
          <div className="card-body">
            {(!employee.deductions || employee.deductions.length === 0) ? (
              <p className="text-core-text3 text-center py-4">No deductions recorded</p>
            ) : (
              <div className="space-y-3">
                {employee.deductions.map((d) => (
                  <div
                    key={d.id}
                    className="flex justify-between items-start p-3 bg-core-surface2 rounded"
                  >
                    <div>
                      <div className="font-semibold">
                        {d.currency} {Number(d.amount).toLocaleString()}
                      </div>
                      <div className="text-xs text-core-text3">
                        {d.description || d.deductionType}
                      </div>
                      <div className="text-xs text-core-text3 mt-0.5">Period: {d.period}</div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-core-roseSoft text-core-roseFg">
                      {d.deductionType}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Billing Splits */}
      <div className="card mt-6">
        <div className="card-header flex justify-between items-center">
          <h3 className="section-heading">Billing Splits</h3>
          <a
            href={`/finance/billing?employeeId=${employee.id}`}
            className="text-xs text-core-blueFg hover:underline"
          >
            Manage
          </a>
        </div>
        <div className="card-body">
          {(!employee.billingSplits || employee.billingSplits.length === 0) ? (
            <p className="text-core-text3 text-center py-4">No billing splits configured</p>
          ) : (
            <div className="space-y-3">
              {employee.billingSplits.map((b) => {
                const active = !b.effectiveTo || new Date(b.effectiveTo) > new Date();
                return (
                  <div
                    key={b.id}
                    className="flex justify-between items-center p-3 bg-core-surface2 rounded"
                  >
                    <div>
                      <div className="font-semibold">
                        {b.company?.name || `Company #${b.companyId}`}
                      </div>
                      <div className="text-xs text-core-text3">
                        From {new Date(b.effectiveFrom).toLocaleDateString()}
                        {b.effectiveTo &&
                          ` — ${new Date(b.effectiveTo).toLocaleDateString()}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">
                        {Number(b.percentage).toFixed(2)}%
                      </span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          active
                            ? 'bg-core-greenSoft text-core-greenFg'
                            : 'bg-core-surface2 text-core-text2'
                        }`}
                      >
                        {active ? 'ACTIVE' : 'ENDED'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function BankInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="form-input"
      />
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
