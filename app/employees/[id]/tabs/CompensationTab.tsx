'use client';

import { useEffect, useState } from 'react';
import { Card, Badge } from '@/app/components/design';
import AddCompensationModal, {
  CompType,
} from '../components/AddCompensationModal';

/**
 * Compensation tab on the employee detail page.
 *
 * Pulls the full per-employee comp bundle from
 * /api/compensation/employee/[id] (salary history, bonuses,
 * commissions, deductions + a precomputed summary card).
 *
 * Edit affordances are gated by the API's `canEdit` flag — HR/Admin
 * see the "+ Add" buttons; everyone else (self, manager-of-self,
 * read-only accountants) sees just the data.
 *
 * Self-contained: no props bled in from the parent because the
 * employee detail page is already hauling around enough state. The
 * tab makes its own fetch on mount and on any successful add.
 */

interface SalaryRow {
  id: number;
  baseSalary: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  incrementPct: string | null;
  reason: string | null;
}

interface BonusRow {
  id: number;
  amount: string;
  currency: string;
  reason: string;
  period: string | null;
  awardedDate: string;
  isPaid: boolean;
}

interface CommissionRow {
  id: number;
  amount: string;
  currency: string;
  description: string;
  period: string;
  isPaid: boolean;
  createdAt: string;
}

interface DeductionRow {
  id: number;
  amount: string;
  currency: string;
  deductionType: string;
  description: string | null;
  period: string;
  createdAt: string;
}

interface Bundle {
  employee: {
    id: number;
    empCode: string;
    firstName: string;
    lastName: string;
    designation: string | null;
    department: { name: string } | null;
  };
  summary: {
    currentBase: number | null;
    currentCurrency: string | null;
    currentSince: string | null;
    lastRaise: {
      effectiveFrom: string;
      incrementPct: number | null;
      previousBase: number;
      reason: string | null;
    } | null;
    ytdBonusPkr: number;
    ytdBonusUsd: number;
    ytdCommissionPkr: number;
    ytdCommissionUsd: number;
  };
  salaryHistory: SalaryRow[];
  bonuses: BonusRow[];
  commissions: CommissionRow[];
  deductions: DeductionRow[];
  canEdit: boolean;
}

export default function CompensationTab({ employeeId }: { employeeId: number }) {
  const [data, setData] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addType, setAddType] = useState<CompType | null>(null);
  // Editing target — the modal flips into edit mode when set.
  // Reuses the same component as the Add modal; the type discriminator
  // tells it which form shape to render and which endpoint to PATCH.
  const [editing, setEditing] = useState<{
    type: CompType;
    id: number;
    data: any;
  } | null>(null);

  const fetchBundle = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/compensation/employee/${employeeId}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed to load');
      setData(j);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBundle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const onAdded = () => {
    setAddType(null);
    setEditing(null);
    fetchBundle();
  };

  const handleDelete = async (kind: CompType, id: number) => {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/compensation/${kind}/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Delete failed');
      }
      fetchBundle();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (loading && !data) {
    return <div className="py-12 text-center text-core-text3">Loading…</div>;
  }
  if (error) {
    return (
      <div className="rounded-lg bg-core-roseSoft p-4 text-[13px] text-core-roseFg">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const { summary, canEdit } = data;
  const fmt = (n: number, ccy: string) =>
    `${ccy} ${Number(n || 0).toLocaleString()}`;

  return (
    <div className="space-y-4">
      {/* Current Compensation Card */}
      <Card title="Current compensation" padded>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Stat
            label="Current Base"
            value={
              summary.currentBase != null
                ? fmt(summary.currentBase, summary.currentCurrency || 'PKR')
                : '—'
            }
            sub={
              summary.currentSince
                ? `since ${new Date(summary.currentSince).toLocaleDateString()}`
                : 'No salary on record'
            }
          />
          <Stat
            label="Last Raise"
            value={
              summary.lastRaise
                ? summary.lastRaise.incrementPct != null
                  ? `${summary.lastRaise.incrementPct >= 0 ? '+' : ''}${summary.lastRaise.incrementPct.toFixed(1)}%`
                  : 'Re-comp'
                : '—'
            }
            sub={
              summary.lastRaise
                ? new Date(summary.lastRaise.effectiveFrom).toLocaleDateString()
                : 'No raise history'
            }
          />
          <Stat
            label="YTD Bonus"
            value={
              summary.ytdBonusPkr || summary.ytdBonusUsd
                ? [
                    summary.ytdBonusPkr ? fmt(summary.ytdBonusPkr, 'PKR') : null,
                    summary.ytdBonusUsd ? fmt(summary.ytdBonusUsd, 'USD') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : '—'
            }
            sub="This calendar year"
          />
          <Stat
            label="YTD Commission"
            value={
              summary.ytdCommissionPkr || summary.ytdCommissionUsd
                ? [
                    summary.ytdCommissionPkr
                      ? fmt(summary.ytdCommissionPkr, 'PKR')
                      : null,
                    summary.ytdCommissionUsd
                      ? fmt(summary.ytdCommissionUsd, 'USD')
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : '—'
            }
            sub="This calendar year"
          />
        </div>
      </Card>

      {/* Salary History */}
      <SectionCard
        title="Salary history"
        subtitle={
          data.salaryHistory.length === 0
            ? 'No entries yet'
            : `${data.salaryHistory.length} ${data.salaryHistory.length === 1 ? 'entry' : 'entries'}`
        }
        canEdit={canEdit}
        onAdd={() => setAddType('salary')}
        addLabel="+ Set New Salary"
      >
        {data.salaryHistory.length === 0 ? (
          <Empty>No salary recorded yet. Use "Set New Salary" to begin.</Empty>
        ) : (
          <div className="divide-y divide-core-border">
            {data.salaryHistory.map((s) => {
              const isActive = s.effectiveTo == null;
              const incPct = s.incrementPct ? Number(s.incrementPct) : null;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-4 py-[10px]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-semibold text-core-text">
                        {s.currency} {Number(s.baseSalary).toLocaleString()}
                      </span>
                      {isActive && <Badge tone="green">Active</Badge>}
                      {incPct != null && (
                        <span
                          className={`text-[11.5px] font-semibold ${incPct >= 0 ? 'text-core-greenFg' : 'text-core-roseFg'}`}
                        >
                          {incPct >= 0 ? '+' : ''}
                          {incPct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <div className="mt-[2px] text-[11.5px] text-core-text3">
                      {new Date(s.effectiveFrom).toLocaleDateString()}
                      {s.effectiveTo
                        ? ` → ${new Date(s.effectiveTo).toLocaleDateString()}`
                        : ' → present'}
                      {s.reason ? ` · ${s.reason}` : ''}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-3 text-[11.5px]">
                      <button
                        onClick={() =>
                          setEditing({ type: 'salary', id: s.id, data: s })
                        }
                        className="text-core-text2 hover:text-core-text"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete('salary', s.id)}
                        className="text-core-text3 hover:text-core-roseFg"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Bonuses */}
      <SectionCard
        title="Bonuses"
        subtitle={
          data.bonuses.length === 0
            ? 'No bonuses recorded'
            : `${data.bonuses.length} ${data.bonuses.length === 1 ? 'bonus' : 'bonuses'}`
        }
        canEdit={canEdit}
        onAdd={() => setAddType('bonus')}
        addLabel="+ Add Bonus"
      >
        {data.bonuses.length === 0 ? (
          <Empty>No bonuses recorded.</Empty>
        ) : (
          <div className="divide-y divide-core-border">
            {data.bonuses.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-4 py-[10px]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold text-core-text">
                      {b.currency} {Number(b.amount).toLocaleString()}
                    </span>
                    {b.isPaid ? (
                      <Badge tone="green">Paid</Badge>
                    ) : (
                      <Badge tone="amber">Unpaid</Badge>
                    )}
                  </div>
                  <div className="mt-[2px] text-[11.5px] text-core-text3">
                    {new Date(b.awardedDate).toLocaleDateString()} ·{' '}
                    {b.reason}
                    {b.period ? ` (${b.period})` : ''}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-3 text-[11.5px]">
                    <button
                      onClick={() =>
                        setEditing({ type: 'bonus', id: b.id, data: b })
                      }
                      className="text-core-text2 hover:text-core-text"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete('bonus', b.id)}
                      className="text-core-text3 hover:text-core-roseFg"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Commissions */}
      <SectionCard
        title="Commissions"
        subtitle={
          data.commissions.length === 0
            ? 'No commissions recorded'
            : `${data.commissions.length} ${data.commissions.length === 1 ? 'entry' : 'entries'}`
        }
        canEdit={canEdit}
        onAdd={() => setAddType('commission')}
        addLabel="+ Add Commission"
      >
        {data.commissions.length === 0 ? (
          <Empty>No commissions recorded.</Empty>
        ) : (
          <div className="divide-y divide-core-border">
            {data.commissions.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-4 py-[10px]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold text-core-text">
                      {c.currency} {Number(c.amount).toLocaleString()}
                    </span>
                    <Badge tone="blue">{c.period}</Badge>
                    {c.isPaid ? (
                      <Badge tone="green">Paid</Badge>
                    ) : (
                      <Badge tone="amber">Unpaid</Badge>
                    )}
                  </div>
                  <div className="mt-[2px] text-[11.5px] text-core-text3">
                    {c.description}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-3 text-[11.5px]">
                    <button
                      onClick={() =>
                        setEditing({ type: 'commission', id: c.id, data: c })
                      }
                      className="text-core-text2 hover:text-core-text"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete('commission', c.id)}
                      className="text-core-text3 hover:text-core-roseFg"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Deductions */}
      <SectionCard
        title="Deductions / Adjustments"
        subtitle={
          data.deductions.length === 0
            ? 'No deductions recorded'
            : `${data.deductions.length} ${data.deductions.length === 1 ? 'entry' : 'entries'}`
        }
        canEdit={canEdit}
        onAdd={() => setAddType('deduction')}
        addLabel="+ Add Deduction"
      >
        {data.deductions.length === 0 ? (
          <Empty>No deductions recorded.</Empty>
        ) : (
          <div className="divide-y divide-core-border">
            {data.deductions.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-4 py-[10px]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold text-core-text">
                      {d.currency} {Number(d.amount).toLocaleString()}
                    </span>
                    <Badge tone="rose">{d.deductionType}</Badge>
                    <Badge tone="blue">{d.period}</Badge>
                  </div>
                  <div className="mt-[2px] text-[11.5px] text-core-text3">
                    {d.description ?? '—'}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-3 text-[11.5px]">
                    <button
                      onClick={() =>
                        setEditing({ type: 'deduction', id: d.id, data: d })
                      }
                      className="text-core-text2 hover:text-core-text"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete('deduction', d.id)}
                      className="text-core-text3 hover:text-core-roseFg"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {addType && (
        <AddCompensationModal
          employeeId={employeeId}
          type={addType}
          onClose={() => setAddType(null)}
          onSuccess={onAdded}
        />
      )}
      {editing && (
        <AddCompensationModal
          employeeId={employeeId}
          type={editing.type}
          editing={{ id: editing.id, data: editing.data }}
          onClose={() => setEditing(null)}
          onSuccess={onAdded}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-core-border bg-core-surface2 px-3 py-3">
      <div
        className="text-[10px] font-bold uppercase text-core-text3"
        style={{ letterSpacing: '0.08em' }}
      >
        {label}
      </div>
      <div className="mt-1 font-mono text-[15px] font-semibold text-core-text">
        {value}
      </div>
      {sub && (
        <div className="mt-[2px] text-[11px] text-core-text3">{sub}</div>
      )}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  canEdit,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  subtitle: string;
  canEdit: boolean;
  onAdd: () => void;
  addLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      title={title}
      subtitle={subtitle}
      action={
        canEdit ? (
          <button
            onClick={onAdd}
            className="text-[12px] font-semibold text-core-greenFg hover:opacity-80"
          >
            {addLabel}
          </button>
        ) : null
      }
      padded
    >
      {children}
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-4 text-center text-[12px] text-core-text3">
      {children}
    </div>
  );
}
