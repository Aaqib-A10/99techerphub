'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, KpiTile, Badge } from '@/app/components/design';

interface Service {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  defaultPlan: string | null;
}

interface MyAccess {
  serviceName: string;
  isActive: boolean;
}

interface MyRequest {
  id: number;
  serviceId: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestedAt: string | Date;
}

interface Props {
  services: Service[];
  myAccess: MyAccess[];
  myRequests: MyRequest[];
  hasEmployeeRecord: boolean;
}

type ServiceStatus =
  | { kind: 'granted' }
  | { kind: 'pending'; requestId: number }
  | { kind: 'rejected'; reason?: string }
  | { kind: 'available' };

export default function AccessCatalogClient({
  services,
  myAccess,
  myRequests,
  hasEmployeeRecord,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requestModal, setRequestModal] = useState<Service | null>(null);
  const [requestNotes, setRequestNotes] = useState('');

  const accessByName = useMemo(() => {
    const m = new Map<string, MyAccess>();
    for (const a of myAccess) m.set(a.serviceName, a);
    return m;
  }, [myAccess]);

  // For each service compute a single canonical status, preferring
  // active grant > pending request > most recent rejection > available.
  const statusByService = useMemo(() => {
    const out = new Map<number, ServiceStatus>();
    for (const svc of services) {
      const access = accessByName.get(svc.name);
      if (access?.isActive) {
        out.set(svc.id, { kind: 'granted' });
        continue;
      }
      const pending = myRequests.find(
        (r) => r.serviceId === svc.id && r.status === 'PENDING',
      );
      if (pending) {
        out.set(svc.id, { kind: 'pending', requestId: pending.id });
        continue;
      }
      const rejected = myRequests.find(
        (r) => r.serviceId === svc.id && r.status === 'REJECTED',
      );
      if (rejected) {
        out.set(svc.id, { kind: 'rejected' });
        continue;
      }
      out.set(svc.id, { kind: 'available' });
    }
    return out;
  }, [services, accessByName, myRequests]);

  const counts = useMemo(() => {
    let granted = 0;
    let pending = 0;
    let available = 0;
    for (const svc of services) {
      const s = statusByService.get(svc.id);
      if (s?.kind === 'granted') granted++;
      else if (s?.kind === 'pending') pending++;
      else available++;
    }
    return { total: services.length, granted, pending, available };
  }, [services, statusByService]);

  // Group services by category for cleaner browsing.
  const grouped = useMemo(() => {
    const m = new Map<string, Service[]>();
    for (const svc of services) {
      const key = svc.category || 'Other';
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(svc);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [services]);

  async function handleRequest(serviceId: number, notes: string) {
    setSubmitting(serviceId);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to submit request');
      setSuccess('Request submitted — admins will review shortly.');
      setRequestModal(null);
      setRequestNotes('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(null);
    }
  }

  async function handleCancel(requestId: number) {
    if (!confirm('Withdraw this request?')) return;
    try {
      const res = await fetch(`/api/access-requests/${requestId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || 'Cancel failed');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
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
          Workspace · Tools
        </div>
        <h1
          className="text-[22px] font-semibold leading-tight text-core-text"
          style={{ letterSpacing: '-0.018em' }}
        >
          Access Catalog
        </h1>
        <p className="mt-[2px] max-w-[640px] text-[13px] text-core-text2">
          Browse the tools your team uses and request access to anything you need. Admins review requests and grant access from here.
        </p>
      </div>

      {!hasEmployeeRecord && (
        <div className="mb-6 rounded-lg bg-core-amberSoft p-4 text-[13px] text-core-amberFg">
          Your user account isn't linked to an employee record yet. Contact an admin to fix this before requesting access.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-core-roseSoft p-4 text-[13px] text-core-roseFg">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-core-greenSoft p-4 text-[13px] text-core-greenFg">
          {success}
        </div>
      )}

      {/* KPI strip */}
      <div className="mb-[18px] grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile tone="violet" label="Total Services" value={counts.total} meta="Available in catalog" />
        <KpiTile tone="green" label="My Access" value={counts.granted} meta="Currently granted" />
        <KpiTile tone="amber" label="Pending" value={counts.pending} meta="Awaiting approval" />
        <KpiTile tone="blue" label="Can Request" value={counts.available} meta="Not yet granted" />
      </div>

      {grouped.map(([category, list]) => (
        <div key={category} className="mb-6">
          <h2
            className="mb-3 text-[10.5px] font-semibold uppercase text-core-text3"
            style={{ letterSpacing: '0.09em' }}
          >
            {category}
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((svc) => {
              const status = statusByService.get(svc.id) ?? { kind: 'available' as const };
              const initials = svc.name
                .split(/\s+/)
                .map((p) => p[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase();
              return (
                <div
                  key={svc.id}
                  className="rounded-2xl border border-core-border bg-core-surface p-[18px] transition hover:bg-core-surface2"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-core-surface2 text-[14px] font-bold text-core-text2"
                        aria-hidden
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div
                          className="truncate text-[14px] font-semibold text-core-text"
                          style={{ letterSpacing: '-0.01em' }}
                        >
                          {svc.name}
                        </div>
                        {svc.defaultPlan && (
                          <div className="mt-[1px] text-[11px] text-core-text3">
                            {svc.defaultPlan}
                          </div>
                        )}
                      </div>
                    </div>
                    {status.kind === 'granted' && <Badge tone="green">Granted</Badge>}
                    {status.kind === 'pending' && <Badge tone="amber">Pending</Badge>}
                    {status.kind === 'rejected' && <Badge tone="rose">Rejected</Badge>}
                  </div>
                  {svc.description && (
                    <p className="mb-3 min-h-[34px] text-[12.5px] leading-snug text-core-text2">
                      {svc.description}
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-2 border-t border-core-border pt-3">
                    {status.kind === 'granted' && (
                      <span className="text-[12px] text-core-text3">
                        You already have access.
                      </span>
                    )}
                    {status.kind === 'pending' && (
                      <button
                        onClick={() => handleCancel(status.requestId)}
                        className="text-[12px] font-semibold text-core-text2 transition hover:text-core-roseFg"
                      >
                        Withdraw request
                      </button>
                    )}
                    {(status.kind === 'available' || status.kind === 'rejected') && (
                      <button
                        onClick={() => {
                          setRequestModal(svc);
                          setRequestNotes('');
                        }}
                        disabled={!hasEmployeeRecord}
                        className="inline-flex items-center gap-[5px] rounded-lg border border-core-text bg-core-text px-[13px] py-2 text-[12.5px] font-semibold text-core-surface transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {status.kind === 'rejected' ? 'Request again' : 'Request access'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Request modal */}
      {requestModal && (
        <div className="modal-overlay" onClick={() => !submitting && setRequestModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Request {requestModal.name}</h2>
              <button
                onClick={() => !submitting && setRequestModal(null)}
                aria-label="Close"
                className="text-core-text3 hover:text-core-text"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p className="mb-3 text-[12.5px] text-core-text2">
                Tell the admin why you need access to {requestModal.name}. A brief note helps speed up approval.
              </p>
              <label className="form-label">Reason (optional)</label>
              <textarea
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                rows={3}
                className="form-textarea"
                placeholder="e.g. Need to review Figma mocks for the Q2 launch"
              />
            </div>
            <div className="modal-footer">
              <button
                onClick={() => !submitting && setRequestModal(null)}
                className="btn btn-secondary"
                disabled={!!submitting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRequest(requestModal.id, requestNotes)}
                disabled={!!submitting}
                className="btn btn-primary"
              >
                {submitting === requestModal.id ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
