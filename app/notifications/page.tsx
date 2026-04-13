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

const notificationIcons: Record<string, string> = {
  ASSET_ASSIGNED: '📦',
  ASSET_RETURNED: '↩️',
  ASSET_RETIRED: '🗑️',
  EXPENSE_SUBMITTED: '💰',
  EXPENSE_APPROVED: '✅',
  EXPENSE_REJECTED: '❌',
  EXPENSE_REVISION: '📝',
  PAYROLL_FINALIZED: '📋',
  PAYROLL_PAID: '💵',
  EMPLOYEE_ONBOARDED: '🎉',
  EMPLOYEE_EXIT: '🚪',
  SYSTEM_ALERT: '⚠️',
  GENERAL: '🔔',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
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

  const filteredNotifications = selectedType
    ? notifications.filter((n) => n.type === selectedType)
    : notifications;

  // Group notifications by date
  const groupedByDate = filteredNotifications.reduce(
    (acc, notif) => {
      const date = new Date(notif.createdAt).toLocaleDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(notif);
      return acc;
    },
    {} as Record<string, Notification[]>
  );

  const uniqueTypes = Array.from(new Set(notifications.map((n) => n.type)));

  return (
    <div className="max-w-4xl mx-auto">
      <PageHero
        eyebrow="System / Inbox"
        title="Notifications"
        description={
          unreadCount > 0
            ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
            : 'All notifications read'
        }
        actions={
          <div className="flex gap-3">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="btn btn-accent">
                Mark All Read
              </button>
            )}
            <button onClick={fetchNotifications} className="btn btn-secondary">
              Refresh
            </button>
          </div>
        }
      />

      {/* Type Filter */}
      {uniqueTypes.length > 0 && (
        <div className="mb-6">
          <div className="tab-bar">
            <button
              onClick={() => setSelectedType(null)}
              className={`tab-btn ${selectedType === null ? 'active' : ''}`}
            >
              All
            </button>
            {uniqueTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`tab-btn ${selectedType === type ? 'active' : ''}`}
              >
                {notificationIcons[type]} {type.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notifications List */}
      {loading ? (
        <div className="text-center py-12">
          <p style={{ color: '#75777E', fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Loading notifications...
          </p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <div style={{ fontSize: 48, color: 'rgba(11,31,58,0.15)', marginBottom: 12 }}>🔔</div>
            <p style={{ color: '#0B1F3A', fontWeight: 700 }}>No notifications yet</p>
            <p style={{ color: '#75777E', fontSize: '0.85rem', marginTop: 6 }}>
              {selectedType
                ? `No notifications of type "${selectedType}"`
                : 'Check back later for updates'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([date, notifs]) => (
            <div key={date}>
              <div className="date-separator">{date}</div>
              <div className="space-y-3">
                {notifs.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (!notif.isRead) markAsRead(notif.id);
                      if (notif.link) window.location.href = notif.link;
                    }}
                    className={`notification-card cursor-pointer ${!notif.isRead ? 'unread' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-2xl flex-shrink-0">
                        {notificationIcons[notif.type] || '🔔'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 style={{ color: '#0B1F3A', fontWeight: 700, fontSize: '0.95rem' }}>{notif.title}</h3>
                            <p style={{ color: '#44474D', marginTop: 4, fontSize: '0.875rem' }}>{notif.message}</p>
                            <p className="mono" style={{ color: '#75777E', marginTop: 8, fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                              {new Date(notif.createdAt).toLocaleString()}
                            </p>
                          </div>
                          {!notif.isRead && (
                            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#14B8A6', flexShrink: 0, marginTop: 8 }} />
                          )}
                        </div>
                        {notif.link && (
                          <div style={{ marginTop: 12 }}>
                            <Link
                              href={notif.link}
                              style={{ fontSize: '0.8rem', fontWeight: 600, color: '#14B8A6' }}
                            >
                              View Details →
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
