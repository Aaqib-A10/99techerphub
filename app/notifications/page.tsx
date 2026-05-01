'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  ASSET_ASSIGNED:
    'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96 12 12.01l8.73-5.05 M12 22.08V12',
  ASSET_RETURNED: 'M3 7l9 6 9-6 M3 7v10l9 6 M21 7v10l-9 6',
  ASSET_RETIRED: 'M3 6h18 M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2 M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6',
  EXPENSE_SUBMITTED: 'M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  EXPENSE_APPROVED: 'M5 13l4 4L19 7',
  EXPENSE_REJECTED: 'M18 6L6 18 M6 6l12 12',
  EXPENSE_REVISION:
    'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  PAYROLL_FINALIZED:
    'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8',
  PAYROLL_PAID: 'M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  EMPLOYEE_ONBOARDED:
    'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M19 8v6 M22 11h-6',
  EMPLOYEE_EXIT:
    'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9',
  SYSTEM_ALERT:
    'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01',
  GENERAL: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0',
};

const TYPE_TINT: Record<string, string> = {
  ASSET_ASSIGNED: 'bg-core-blueSoft text-core-blueFg',
  ASSET_RETURNED: 'bg-core-surface2 text-core-text2',
  ASSET_RETIRED: 'bg-core-surface2 text-core-text2',
  EXPENSE_SUBMITTED: 'bg-core-amberSoft text-core-amberFg',
  EXPENSE_APPROVED: 'bg-core-greenSoft text-core-greenFg',
  EXPENSE_REJECTED: 'bg-core-roseSoft text-core-roseFg',
  EXPENSE_REVISION: 'bg-core-amberSoft text-core-amberFg',
  PAYROLL_FINALIZED: 'bg-core-violetSoft text-core-violetFg',
  PAYROLL_PAID: 'bg-core-greenSoft text-core-greenFg',
  EMPLOYEE_ONBOARDED: 'bg-core-greenSoft text-core-greenFg',
  EMPLOYEE_EXIT: 'bg-core-surface2 text-core-text2',
  SYSTEM_ALERT: 'bg-core-amberSoft text-core-amberFg',
  GENERAL: 'bg-core-surface2 text-core-text2',
};

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isToday = d.toDateString() === today.toDateString();
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await fetch(`/api/notifications?id=${id}`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications?action=mark_all_read', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const visible = notifications
    .filter((n) => (selectedType ? n.type === selectedType : true))
    .filter((n) => (filter === 'unread' ? !n.isRead : true));

  const groupedByDate = visible.reduce(
    (acc, notif) => {
      const key = dateLabel(notif.createdAt);
      if (!acc[key]) acc[key] = [];
      acc[key].push(notif);
      return acc;
    },
    {} as Record<string, Notification[]>
  );

  const uniqueTypes = Array.from(new Set(notifications.map((n) => n.type)));

  return (
    <div className="max-w-3xl mx-auto">
      <PageHero
        eyebrow="System / Inbox"
        title="Notifications"
        description={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
            : 'You\u2019re all caught up.'
        }
        actions={
          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchNotifications}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-core-border/95 bg-core-surface px-2.5 text-[12.5px] font-medium text-core-text2 transition-all hover:border-core-border hover:bg-core-surface2"
              title="Refresh"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="text-core-text3">
                <path d="M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M20.49 15a9 9 0 01-14.85 3.36L1 14" />
              </svg>
              Refresh
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="inline-flex h-8 items-center rounded-md bg-[#1F2320] px-3 text-[12.5px] font-medium text-white transition-opacity hover:opacity-95"
              >
                Mark all read
              </button>
            )}
          </div>
        }
      />

      {/* Filter row — read/unread + type chip */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex h-8 items-center gap-0.5 rounded-md border border-core-border/95 bg-core-surface p-0.5">
          <button
            onClick={() => setFilter('all')}
            className={`inline-flex h-7 items-center rounded px-3 text-[12px] font-medium transition-all ${
              filter === 'all'
                ? 'bg-core-surface2 text-core-text'
                : 'text-core-text3 hover:text-core-text'
            }`}
          >
            All
            <span className="ml-1.5 text-[10.5px] tabular-nums text-core-text3">
              {notifications.length}
            </span>
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`inline-flex h-7 items-center rounded px-3 text-[12px] font-medium transition-all ${
              filter === 'unread'
                ? 'bg-core-surface2 text-core-text'
                : 'text-core-text3 hover:text-core-text'
            }`}
          >
            Unread
            <span className="ml-1.5 text-[10.5px] tabular-nums text-core-text3">
              {unreadCount}
            </span>
          </button>
        </div>

        {uniqueTypes.length > 0 && (
          <select
            value={selectedType || ''}
            onChange={(e) => setSelectedType(e.target.value || null)}
            className="h-8 rounded-md border border-core-border/95 bg-core-surface pl-2.5 pr-8 text-[12.5px] font-medium text-core-text2 transition-all hover:border-core-border focus:border-zinc-400 focus:outline-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2371717A' stroke-width='1.6'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              backgroundSize: '13px',
              appearance: 'none',
            }}
          >
            <option value="">All types</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ').toLowerCase().replace(/^./, (m) => m.toUpperCase())}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="rounded-lg border border-core-border/85 bg-core-surface p-12 text-center text-[12.5px] text-core-text3">
          Loading notifications…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-core-border/85 bg-core-surface p-12 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-core-surface2 text-core-text3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            </svg>
          </div>
          <p className="mt-3 text-[13px] font-medium text-core-text">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="mt-0.5 text-[12px] text-core-text3">
            {selectedType
              ? `Nothing matches the "${selectedType.replace(/_/g, ' ').toLowerCase()}" filter.`
              : 'Updates from across the system will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([date, group]) => (
            <div key={date}>
              <h2 className="mb-2 px-1 text-[10.5px] font-medium uppercase tracking-[0.06em] text-core-text3">
                {date}
              </h2>
              <div className="overflow-hidden rounded-lg border border-core-border/85 bg-core-surface">
                {group.map((notif, i) => {
                  const tint = TYPE_TINT[notif.type] || TYPE_TINT.GENERAL;
                  const iconPath = TYPE_ICONS[notif.type] || TYPE_ICONS.GENERAL;
                  return (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (!notif.isRead) markAsRead(notif.id);
                        if (notif.link) window.location.href = notif.link;
                      }}
                      className={`group flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-core-surface2 ${
                        i > 0 ? 'border-t border-core-border' : ''
                      } ${!notif.isRead ? 'bg-core-surface2/40' : ''}`}
                    >
                      <span
                        className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${tint}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                          <path d={iconPath} />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-[13px] ${
                            !notif.isRead ? 'font-semibold text-core-text' : 'font-medium text-core-text'
                          }`}>
                            {notif.title}
                          </p>
                          <span className="flex-shrink-0 text-[10.5px] tabular-nums text-core-text3">
                            {relativeTime(notif.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[12.5px] text-core-text2">
                          {notif.message}
                        </p>
                        {notif.link && (
                          <Link
                            href={notif.link}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-core-text3 transition-colors hover:text-core-text"
                          >
                            Open
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12h14 M12 5l7 7-7 7" />
                            </svg>
                          </Link>
                        )}
                      </div>
                      {!notif.isRead && (
                        <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-core-text" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
