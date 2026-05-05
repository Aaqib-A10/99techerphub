'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, KpiTile, Badge, Avi, Tag } from '@/app/components/design';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

interface AccessRequest {
  id: number;
  status: RequestStatus;
  notes: string | null;
  reviewNotes: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  employee: {
    id: number;
    firstName: string;
    lastName: string;
    empCode: string;
    email: string | null;
    designation: string | null;
    department: { id: number; name: string } | null;
    photoUrl: string | null;
  };
  service: {
    id: number;
    name: string;
    category: string | null;
    defaultPlan: string | null;
  };
  reviewer: { id: number; email: string } | null;
}

interface Props {
  initialRequests: AccessRequest[];
}

const TONE_BY_STATUS: Record<RequestStatus, 'amber' | 'green' | 'rose' | 'gray'> = {
  PENDING: 'amber',
  APPROVED: 'green',
  REJECTED: 'rose',
  CANCELLED: 'gray',
};

export default function AccessRequestsClient({ initialRequests }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<RequestStatus>('PENDING');
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [approveModal, setApproveModal] = useState<AccessRequest | null>(null);
  const [rejectModal, setRejectModal] = useState<AccessRequest | null>(null);
  const [accountId, setAccountId] = useState('');
  // Two distinct fields on approve. Reject still uses just one (the reason).
  const [credentialMessage, setCredentialMessage] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  // The three soft-reminder checkboxes — display-only, not persisted.
  // They reset every time a new approve modal opens.
  const [chk, setChk] = useState({ created: false, sent: false, verified: false });

  const counts = useMemo(() => {
    let pending = 0,
      approved = 0,
      rejected = 0,
      cancelled = 0;
    for (const r of initialRequests) {
      if (r.status === 'PENDING') pending++;
      else if (r.status === 'APPROVED') approved++;
      else if (r.status === 'REJECTED') rejected++;
      else cancelled++;
    }
    return { pending, approved, rejected, cancelled };
  }, [initialRequests]);

  const visible = useMemo(
    () => initialRequests.filter((r) => r.status === tab),
    [initialRequests, tab],
  );

  async function approve(req: AccessRequest) {
    setBusy(req.id);
    setError('');
    try {
      const res = await fetch(`/api/access-requests/${req.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          credentialMessage,
          internalNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Approve failed');
      setApproveModal(null);
      setAccountId('');
      setCredentialMessage('');
      setInternalNotes('');
      setChk({ created: false, sent: false, verified: false });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusy(null);
    }
  }

  async function reject(req: AccessRequest, reason: string) {
    setBusy(req.id);
    setError('');
    try {
      const res = await fetch(`/api/access-requests/${req.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewNotes: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Reject failed');
      setRejectModal(null);
      setRejectNotes('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <div
          className="mb-[6px] text-[10.5px] font-semibold uppercase text-core-text3"
          style={{ letterSpacing: '0.09em' }}
        >
          System · Access Requests
        </div>
        <h1
          className="text-[22px] font-semibold leading-tight text-core-text"
          style={{ letterSpacing: '-0.018em' }}
        >
          Access Request Queue
        </h1>
        <p className="mt-[2px] text-[13px] text-core-text2">
          Review pending requests from employees and grant or deny access.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-core-roseSoft p-4 text-[13px] text-core-roseFg">
          {error}
        </div>
      )}

      {/* KPI strip — clickable, switches the tab below. */}
      <div className="mb-[18px] grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            { key: 'PENDING', label: 'Pending', value: counts.pending, tone: 'amber' as const },
            { key: 'APPROVED', label: 'Approved', value: counts.approved, tone: 'green' as const },
            { key: 'REJECTED', label: 'Rejected', value: counts.rejected, tone: 'rose' as const },
            { key: 'CANCELLED', label: 'Cancelled', value: counts.cancelled, tone: 'violet' as const },
          ] as const
        ).map((k) => {
          const isActive = tab === k.key;
          return (
            <button
              key={k.key}
              type="button"
              onClick={() => setTab(k.key as RequestStatus)}
              className={`block text-left transition focus:outline-none ${
                isActive
                  ? 'rounded-2xl ring-2 ring-core-text/15 ring-offset-2 ring-offset-core-bg'
                  : 'hover:opacity-90'
              }`}
            >
              <KpiTile tone={k.tone} label={k.label} value={k.value} />
            </button>
          );
        })}
      </div>

      <Card
        title={`${tab.charAt(0)}${tab.slice(1).toLowerCase()} Requests`}
        subtitle={`${visible.length} ${visible.length === 1 ? 'request' : 'requests'}`}
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-core-surface2">
                {['Requester', 'Service', 'Reason', 'Requested', 'Status', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="border-b border-core-border px-[14px] py-[10px] text-left text-[10px] font-bold uppercase text-core-text3"
                    style={{ letterSpacing: '0.08em' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-[14px] py-12 text-center text-core-text3">
                    No {tab.toLowerCase()} requests.
                  </td>
                </tr>
              ) : (
                visible.map((r, idx) => {
                  const isLast = idx === visible.length - 1;
                  const initials = (
                    `${r.employee.firstName?.[0] ?? ''}${r.employee.lastName?.[0] ?? ''}`
                  ).toUpperCase();
                  return (
                    <tr
                      key={r.id}
                      style={{ borderBottom: isLast ? 'none' : '1px solid #E5E8DD' }}
                    >
                      <td className="px-[14px] py-3">
                        <div className="flex items-center gap-[10px]">
                          <Avi
                            seed={r.employee.empCode}
                            initials={initials || '?'}
                            size={28}
                            photoUrl={r.employee.photoUrl}
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-core-text">
                              {r.employee.firstName} {r.employee.lastName}
                            </div>
                            <div className="mt-[1px] text-[11px] text-core-text3">
                              <span className="font-mono">{r.employee.empCode}</span>
                              {r.employee.department?.name
                                ? ` · ${r.employee.department.name}`
                                : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-[14px] py-3">
                        <div className="font-medium text-core-text">{r.service.name}</div>
                        {r.service.defaultPlan && (
                          <div className="mt-[1px] text-[11px] text-core-text3">
                            {r.service.defaultPlan}
                          </div>
                        )}
                      </td>
                      <td className="px-[14px] py-3 text-core-text2 max-w-[280px]">
                        {r.notes || <span className="text-core-text3">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-[14px] py-3 text-core-text2 tabular-nums">
                        {new Date(r.requestedAt).toLocaleDateString()}
                      </td>
                      <td className="px-[14px] py-3">
                        <Badge tone={TONE_BY_STATUS[r.status]}>{r.status}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-[14px] py-3">
                        {r.status === 'PENDING' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setApproveModal(r);
                                setAccountId(r.employee.email || '');
                                setCredentialMessage('');
                                setInternalNotes('');
                                setChk({ created: false, sent: false, verified: false });
                              }}
                              disabled={busy === r.id}
                              className="inline-flex items-center gap-[5px] rounded-lg border border-core-greenFg bg-core-greenSoft px-[10px] py-[5px] text-[12px] font-semibold text-core-greenFg transition hover:opacity-90 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setRejectModal(r);
                                setRejectNotes('');
                              }}
                              disabled={busy === r.id}
                              className="inline-flex items-center gap-[5px] rounded-lg border border-core-roseFg bg-core-roseSoft px-[10px] py-[5px] text-[12px] font-semibold text-core-roseFg transition hover:opacity-90 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : r.reviewNotes ? (
                          <span className="text-[11.5px] italic text-core-text3">
                            “{r.reviewNotes}”
                          </span>
                        ) : (
                          <span className="text-core-text3">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Approve modal */}
      {approveModal && (
        <div className="modal-overlay" onClick={() => !busy && setApproveModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Approve {approveModal.service.name}</h2>
              <button
                onClick={() => !busy && setApproveModal(null)}
                aria-label="Close"
                className="text-core-text3 hover:text-core-text"
              >
                ×
              </button>
            </div>
            <div className="modal-body space-y-4">
              <p className="text-[12.5px] text-core-text2">
                Granting <strong>{approveModal.employee.firstName} {approveModal.employee.lastName}</strong> access to <strong>{approveModal.service.name}</strong>.
              </p>

              {/* Section 1 — admin-only audit trail. */}
              <ModalSection title="Record in our system">
                <div>
                  <label className="form-label">Account ID</label>
                  <input
                    type="text"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="form-input"
                    placeholder="email or username on the service"
                  />
                  <p className="mt-[4px] text-[11px] text-core-text3">
                    Their identifier on the service.
                  </p>
                </div>
                <div className="mt-3">
                  <label className="form-label">Internal notes</label>
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={2}
                    className="form-textarea"
                    placeholder="License tier, billing notes, etc."
                  />
                  <p className="mt-[4px] text-[11px] text-core-text3">
                    Stays in our records — not shown to the requester.
                  </p>
                </div>
              </ModalSection>

              {/* Section 2 — what the requester sees. */}
              <ModalSection title="Tell the requester">
                <label className="form-label">How they'll get their credentials</label>
                <textarea
                  value={credentialMessage}
                  onChange={(e) => setCredentialMessage(e.target.value)}
                  rows={3}
                  className="form-textarea"
                  placeholder="e.g. Invite sent to your work email — check inbox + spam. Reset your password on first login."
                />
                <p className="mt-[4px] text-[11px] text-core-text3">
                  This message goes into the approval email they receive.
                </p>
              </ModalSection>

              {/* Section 3 — soft reminders, not enforced. */}
              <ModalSection title="Before you approve">
                <ChecklistItem
                  checked={chk.created}
                  onChange={(v) => setChk((p) => ({ ...p, created: v }))}
                  label="I created their account in the actual service"
                />
                <ChecklistItem
                  checked={chk.sent}
                  onChange={(v) => setChk((p) => ({ ...p, sent: v }))}
                  label="I sent or queued their credentials"
                />
                <ChecklistItem
                  checked={chk.verified}
                  onChange={(v) => setChk((p) => ({ ...p, verified: v }))}
                  label="I confirmed the access works (or the requester will)"
                />
                <p className="mt-2 text-[11px] text-core-text3">
                  Reminder only — not enforced. Approving without ticking these
                  still grants the record on our side.
                </p>
              </ModalSection>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => !busy && setApproveModal(null)}
                className="btn btn-secondary"
                disabled={busy === approveModal.id}
              >
                Cancel
              </button>
              <button
                onClick={() => approve(approveModal)}
                disabled={busy === approveModal.id}
                className="btn btn-primary"
              >
                {busy === approveModal.id ? 'Approving…' : 'Approve & Grant Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="modal-overlay" onClick={() => !busy && setRejectModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reject {rejectModal.service.name}</h2>
              <button
                onClick={() => !busy && setRejectModal(null)}
                aria-label="Close"
                className="text-core-text3 hover:text-core-text"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="mb-3 text-[12.5px] text-core-text2">
                Tell <strong>{rejectModal.employee.firstName}</strong> why this request was declined. They'll see this message in their notification.
              </p>
              <label className="form-label">Reason *</label>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                rows={3}
                className="form-textarea"
                placeholder="e.g. This tool isn't right for your role — try the catalog for an alternative."
                required
              />
            </div>
            <div className="modal-footer">
              <button
                onClick={() => !busy && setRejectModal(null)}
                className="btn btn-secondary"
                disabled={busy === rejectModal.id}
              >
                Cancel
              </button>
              <button
                onClick={() => reject(rejectModal, rejectNotes)}
                disabled={busy === rejectModal.id || !rejectNotes.trim()}
                className="btn btn-primary"
              >
                {busy === rejectModal.id ? 'Rejecting…' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny helpers for the approve modal sections + checklist row. Inline rather
// than living in /design because they're not used anywhere else yet.
function ModalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-core-border bg-core-surface2 p-3">
      <div
        className="mb-2 text-[10px] font-semibold uppercase text-core-text3"
        style={{ letterSpacing: '0.09em' }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function ChecklistItem({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 py-[3px] text-[12.5px] text-core-text2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-[3px] h-4 w-4 flex-shrink-0"
        style={{ accentColor: '#1F2320' }}
      />
      <span className={checked ? 'text-core-text' : ''}>{label}</span>
    </label>
  );
}
