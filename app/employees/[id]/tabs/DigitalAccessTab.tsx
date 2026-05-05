'use client';

import Link from 'next/link';
import { Badge } from '@/app/components/design';

/**
 * Digital Access tab — list of granted services + revoke action.
 *
 * Pure presentation. The Grant modal and the revoke API call live in the
 * parent (client.tsx) so this component doesn't need to own session/auth
 * concerns; it just renders the rows and calls back when something happens.
 */

interface DigitalAccessRow {
  id: number;
  serviceName: string;
  accountId: string | null;
  grantedDate: Date | string;
  isActive: boolean;
}

interface Props {
  digitalAccess: DigitalAccessRow[];
  onGrantClick: () => void;
  onRevoke: (accessId: number) => void;
  /** Admin/HR can grant access directly. Everyone else just sees the
   *  catalog link, since they have to go through the request workflow. */
  canGrant?: boolean;
}

export default function DigitalAccessTab({
  digitalAccess,
  onGrantClick,
  onRevoke,
  canGrant = false,
}: Props) {
  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="section-heading">Digital Access &amp; Licenses</h3>
        <div className="flex items-center gap-2">
          {/* Catalog link is always visible — anyone (admin or employee
              viewing themselves) can browse it. Direct Grant Access stays
              admin/HR-only since it bypasses the approval flow. */}
          <Link
            href="/access-catalog"
            className="text-[12px] font-semibold text-core-text2 transition hover:text-core-text"
          >
            Browse catalog →
          </Link>
          {canGrant && (
            <button onClick={onGrantClick} className="btn btn-sm btn-primary">
              Grant Access
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="bg-core-surface2">
              {['Service', 'Account ID', 'Granted Date', 'Status', 'Actions'].map((h) => (
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
            {digitalAccess.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-[14px] py-12 text-center text-core-text3">
                  No digital access records
                </td>
              </tr>
            ) : (
              digitalAccess.map((da, idx) => {
                const isLast = idx === digitalAccess.length - 1;
                return (
                  <tr
                    key={da.id}
                    className="transition-colors hover:bg-core-surface2"
                    style={{ borderBottom: isLast ? 'none' : '1px solid #E5E8DD' }}
                  >
                    <td className="px-[14px] py-3 font-medium text-core-text">
                      {da.serviceName}
                    </td>
                    <td className="px-[14px] py-3 font-mono text-[11.5px] text-core-text2">
                      {da.accountId || <span className="text-core-text3">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-[14px] py-3 text-core-text2 tabular-nums">
                      {new Date(da.grantedDate).toLocaleDateString()}
                    </td>
                    <td className="px-[14px] py-3">
                      {da.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="rose">Revoked</Badge>}
                    </td>
                    <td className="px-[14px] py-3">
                      {da.isActive && (
                        <button
                          onClick={() => onRevoke(da.id)}
                          className="btn btn-sm btn-danger"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
