'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NotificationBell from './NotificationBell';

interface CurrentUser {
  email: string;
  role: string;
}

interface TopbarProps {
  onMenuToggle?: () => void;
}

const COLLAPSED_KEY = '99core.sidebar.collapsed';

function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

// Map first segment of pathname to a section label.
const SECTION_LABELS: Record<string, string> = {
  '': 'Dashboard',
  'org-chart': 'Org Chart',
  employees: 'Employees',
  'onboarding-admin': 'Onboarding',
  'offer-letters': 'Offer Letters',
  assets: 'Assets',
  'digital-access': 'Digital Access',
  finance: 'Finance',
  expenses: 'Expenses',
  'master-data': 'Master Data',
  audit: 'Audit Trail',
  settings: 'Settings',
  notifications: 'Notifications',
  labs: 'Labs',
};

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const pathname = usePathname() || '/';
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsed());
    setHydrated(true);
  }, []);

  // Listen for changes (the sidebar component also writes to this key)
  useEffect(() => {
    const handler = () => setCollapsed(readCollapsed());
    window.addEventListener('99core:sidebar-toggled', handler);
    return () => window.removeEventListener('99core:sidebar-toggled', handler);
  }, []);

  function toggleSidebar() {
    const next = !collapsed;
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {}
    setCollapsed(next);
    window.dispatchEvent(new CustomEvent('99core:sidebar-toggled'));
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.user && setUser(data.user))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Build breadcrumb from path
  const segments = pathname.split('/').filter(Boolean);
  const sectionKey = segments[0] || '';
  const sectionLabel = SECTION_LABELS[sectionKey] || sectionKey;

  const initials = (user?.email?.[0] || 'U').toUpperCase();

  return (
    <div className="topbar">
      <div className="topbar-content">
        {/* Left: sidebar toggle + breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Mobile hamburger (slide-out drawer) */}
          <button
            onClick={onMenuToggle}
            className="lg:hidden -ml-1 flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Toggle menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>

          {/* Desktop sidebar collapse toggle */}
          {hydrated && (
            <button
              onClick={toggleSidebar}
              className="hidden lg:flex -ml-1 h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
                {collapsed ? (
                  <path d="M14 9l3 3-3 3" />
                ) : (
                  <path d="M16 9l-3 3 3 3" />
                )}
              </svg>
            </button>
          )}

          <div className="flex items-center gap-1.5 text-[12.5px] min-w-0 ml-1">
            <span className="text-zinc-500">99Core</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="text-zinc-300">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-medium text-zinc-900 truncate">{sectionLabel}</span>
          </div>
        </div>

        {/* Right: search + actions */}
        <div className="flex items-center gap-1.5">
          <div className="hidden md:flex h-8 w-64 items-center rounded-md border border-zinc-200/95 bg-white pl-2.5 pr-1.5 transition-all duration-200 hover:border-zinc-300 focus-within:border-zinc-400 focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="text-zinc-400 flex-shrink-0">
              <path d="M21 21l-4.35-4.35 M11 19a8 8 0 100-16 8 8 0 000 16z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              type="text"
              placeholder="Search…"
              className="ml-2 flex-1 bg-transparent text-[12.5px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
            <kbd className="inline-flex items-center rounded border border-zinc-200 px-1 py-0.5 font-sans text-[9.5px] text-zinc-400">
              ⌘K
            </kbd>
          </div>

          <NotificationBell />

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex h-8 items-center gap-2 rounded-md pl-1 pr-2 transition-colors hover:bg-zinc-100"
            >
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-white text-[10.5px] font-semibold"
                style={{ backgroundColor: '#0B1F3A' }}
              >
                {initials}
              </div>
              <span className="hidden sm:block text-[12.5px] font-medium text-zinc-900">
                {user?.email?.split('@')[0] || 'User'}
              </span>
              <svg
                width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
                className={`hidden sm:block text-zinc-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {showDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                <div className="absolute right-0 mt-2 w-56 rounded-lg bg-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.12)] border border-zinc-200/85 z-50 overflow-hidden">
                  <div className="px-3.5 py-3 border-b border-zinc-100">
                    <p className="text-[12.5px] font-medium text-zinc-900 truncate">{user?.email}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 uppercase tracking-wider">{user?.role}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/settings"
                      className="block px-3.5 py-1.5 text-[12.5px] text-zinc-700 hover:bg-zinc-50"
                      onClick={() => setShowDropdown(false)}
                    >
                      Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-3.5 py-1.5 text-[12.5px] text-zinc-700 hover:bg-zinc-50"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
