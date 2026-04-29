'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

// Stroke-icon set per notification type. Drawn at 14px with currentColor.
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

// Color tint per type, used on the small icon chip
const TYPE_TINT: Record<string, string> = {
  ASSET_ASSIGNED: 'bg-blue-50 text-blue-600',
  ASSET_RETURNED: 'bg-zinc-100 text-zinc-600',
  ASSET_RETIRED: 'bg-zinc-100 text-zinc-600',
  EXPENSE_SUBMITTED: 'bg-amber-50 text-amber-700',
  EXPENSE_APPROVED: 'bg-emerald-50 text-emerald-600',
  EXPENSE_REJECTED: 'bg-rose-50 text-rose-600',
  EXPENSE_REVISION: 'bg-amber-50 text-amber-700',
  PAYROLL_FINALIZED: 'bg-violet-50 text-violet-600',
  PAYROLL_PAID: 'bg-emerald-50 text-emerald-600',
  EMPLOYEE_ONBOARDED: 'bg-emerald-50 text-emerald-600',
  EMPLOYEE_EXIT: 'bg-zinc-100 text-zinc-600',
  SYSTEM_ALERT: 'bg-amber-50 text-amber-700',
  GENERAL: 'bg-zinc-100 text-zinc-600',
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

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
  };

  const markAsRead = async (id: number) => {
    try {
      await fetch(`/api/notifications?id=${id}`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications?action=mark_all_read', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 ${
          isOpen ? 'bg-zinc-100 text-zinc-900' : ''
        }`}
        aria-label="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[#FAFAFA]" />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[380px] overflow-hidden rounded-lg border border-zinc-200/85 bg-white shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold text-zinc-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-900 px-1 text-[10px] font-semibold text-white tabular-nums">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11.5px] font-medium text-zinc-500 transition-colors hover:text-zinc-900"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  </svg>
                </div>
                <p className="mt-3 text-[12.5px] font-medium text-zinc-700">You&apos;re all caught up</p>
                <p className="mt-0.5 text-[11.5px] text-zinc-500">No notifications right now.</p>
              </div>
            ) : (
              <ul>
                {notifications.map((n) => {
                  const tint = TYPE_TINT[n.type] || TYPE_TINT.GENERAL;
                  const iconPath = TYPE_ICONS[n.type] || TYPE_ICONS.GENERAL;
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => {
                          if (!n.isRead) markAsRead(n.id);
                          if (n.link) window.location.href = n.link;
                        }}
                        className={`group flex w-full items-start gap-3 border-b border-zinc-100 px-3.5 py-3 text-left transition-colors hover:bg-zinc-50 ${
                          !n.isRead ? 'bg-zinc-50/40' : ''
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${tint}`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                            <path d={iconPath} />
                          </svg>
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`truncate text-[12.5px] ${
                              !n.isRead ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-800'
                            }`}>
                              {n.title}
                            </p>
                            <span className="flex-shrink-0 text-[10.5px] text-zinc-400 tabular-nums">
                              {relativeTime(n.createdAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-[11.5px] text-zinc-500">
                            {n.message}
                          </p>
                        </div>
                        {!n.isRead && (
                          <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-900" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-100 bg-zinc-50/40">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="flex h-9 items-center justify-center text-[12px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
