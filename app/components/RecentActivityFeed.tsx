import { prisma } from '@/lib/prisma';
import Link from 'next/link';

type ActivityColor = 'emerald' | 'blue' | 'amber' | 'rose' | 'indigo' | 'slate';

type ActivityItem = {
  id: number;
  icon: string;
  title: string;
  detail?: string;
  href?: string;
  time: Date;
  color: ActivityColor;
};

const MODULE_META: Record<string, { color: ActivityColor; icon: string; hrefBase?: (id: number) => string }> = {
  ASSET: {
    color: 'blue',
    icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
    hrefBase: (id) => `/assets/${id}`,
  },
  EMPLOYEE: {
    color: 'emerald',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    hrefBase: (id) => `/employees/${id}`,
  },
  EXPENSE: {
    color: 'amber',
    icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
    hrefBase: (id) => `/expenses/${id}`,
  },
  DIGITAL_ACCESS: {
    color: 'indigo',
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    hrefBase: () => `/digital-access`,
  },
  OFFER_LETTER: {
    color: 'indigo',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    hrefBase: (id) => `/offer-letters/${id}`,
  },
};

const ACTIVITY_COLORS: Record<ActivityColor, { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600' },
  slate:   { bg: 'bg-slate-100',  text: 'text-slate-600' },
};

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function describeAudit(log: any): string {
  const mod = (log.module || '').replace(/_/g, ' ').toLowerCase();
  const name = mod || log.tableName || 'record';
  const singular = name.endsWith('s') ? name.slice(0, -1) : name;
  const verb = log.action === 'CREATE' ? 'created' : log.action === 'UPDATE' ? 'updated' : 'deleted';
  return `${singular.charAt(0).toUpperCase()}${singular.slice(1)} ${verb}`;
}

function describeDetail(log: any): string | undefined {
  const v = log.newValues || log.oldValues;
  if (!v || typeof v !== 'object') return undefined;
  const display =
    v.expenseNumber ||
    v.empCode ||
    v.serialNumber ||
    v.name ||
    (v.firstName && v.lastName ? `${v.firstName} ${v.lastName}` : undefined) ||
    v.title ||
    v.description;
  return typeof display === 'string' ? display : undefined;
}

interface RecentActivityFeedProps {
  /** Number of items to show. Defaults to 12. */
  take?: number;
  /** If true, the section is open on first render. Defaults to true. */
  defaultOpen?: boolean;
}

export default async function RecentActivityFeed({
  take = 12,
  defaultOpen = true,
}: RecentActivityFeedProps) {
  const recentAuditLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      changedBy: { select: { id: true, email: true } },
    },
  });

  const activity: ActivityItem[] = recentAuditLogs.map((log) => {
    const meta = MODULE_META[(log.module || '').toUpperCase()] || {
      color: 'slate' as const,
      icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    };
    return {
      id: log.id,
      icon: meta.icon,
      color: meta.color,
      title: describeAudit(log),
      detail: describeDetail(log),
      href: meta.hrefBase ? meta.hrefBase(log.recordId) : undefined,
      time: log.createdAt,
    };
  });

  return (
    <details
      {...(defaultOpen ? { open: true } : {})}
      className="group rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
    >
      <summary className="flex items-center justify-between px-5 py-3 cursor-pointer list-none select-none hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <svg
            className="w-4 h-4 text-gray-400 transition-transform duration-200 group-open:rotate-90"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
            <p className="text-xs text-gray-500">
              {activity.length === 0
                ? 'No activity yet'
                : `${activity.length} latest change${activity.length === 1 ? '' : 's'} across the system`}
            </p>
          </div>
        </div>
      </summary>
      <div className="border-t border-gray-100">
        {activity.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-500">
            No activity yet. As you create, edit or remove records, they'll appear here.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {activity.map((item) => {
              const c = ACTIVITY_COLORS[item.color] || ACTIVITY_COLORS.slate;
              const body = (
                <div className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className={`w-9 h-9 rounded-full ${c.bg} ${c.text} flex items-center justify-center flex-shrink-0`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    {item.detail && (
                      <p className="text-xs text-gray-500 truncate">{item.detail}</p>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                    {relativeTime(item.time)}
                  </div>
                </div>
              );
              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link href={item.href} className="block">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
