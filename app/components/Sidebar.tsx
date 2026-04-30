'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { UserRole } from '@prisma/client';

type NavChild = {
  name: string;
  href: string;
  requiredRoles?: UserRole[];
};

type NavGroup = {
  type: 'group';
  name: string;
  icon: string;
  requiredRoles?: UserRole[];
  children: NavChild[];
};

type NavLeaf = {
  type: 'link';
  name: string;
  href: string;
  icon: string;
  requiredRoles?: UserRole[];
};

type NavEntry = NavGroup | NavLeaf;

const ICON_DASHBOARD =
  'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z';
const ICON_PEOPLE =
  'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75';
const ICON_BOX =
  'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96 12 12.01l8.73-5.05 M12 22.08V12';
const ICON_MONEY = 'M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6';
const ICON_COG =
  'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z';

const navStructure: NavEntry[] = [
  { type: 'link', name: 'Dashboard', href: '/', icon: ICON_DASHBOARD },
  { type: 'link', name: 'Org Chart', href: '/org-chart', icon: ICON_PEOPLE },
  {
    type: 'group',
    name: 'Employees',
    icon: ICON_PEOPLE,
    requiredRoles: ['ADMIN', 'HR', 'MANAGER'],
    children: [
      { name: 'All Employees', href: '/employees' },
      { name: 'Roles & Responsibilities', href: '/people/responsibilities' },
      { name: 'Onboarding', href: '/onboarding-admin' },
      { name: 'Offer Letters', href: '/offer-letters' },
    ],
  },
  {
    type: 'group',
    name: 'Assets',
    icon: ICON_BOX,
    requiredRoles: ['ADMIN', 'HR'],
    children: [
      { name: 'All Assets', href: '/assets' },
      { name: 'Digital Access', href: '/digital-access' },
    ],
  },
  {
    type: 'group',
    name: 'Finance',
    icon: ICON_MONEY,
    requiredRoles: ['ADMIN', 'ACCOUNTANT', 'MANAGER'],
    children: [
      { name: 'Overview', href: '/finance' },
      { name: 'Salary', href: '/finance/salary' },
      { name: 'Commissions', href: '/finance/commissions' },
      { name: 'Deductions', href: '/finance/deductions' },
      { name: 'Billing Splits', href: '/finance/billing' },
      { name: 'Expenses', href: '/expenses' },
      { name: 'Payroll', href: '/finance/payroll' },
      { name: 'Reports', href: '/finance/reports' },
    ],
  },
  {
    type: 'group',
    name: 'System',
    icon: ICON_COG,
    requiredRoles: ['ADMIN'],
    children: [
      { name: 'Users & Access', href: '/settings/users', requiredRoles: ['ADMIN'] },
      { name: 'Master Data', href: '/master-data' },
      { name: 'Audit Trail', href: '/audit' },
      { name: 'Settings', href: '/settings' },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const COLLAPSED_KEY = '99core.sidebar.collapsed';
const SIDEBAR_W_EXPANDED = 224;
const SIDEBAR_W_COLLAPSED = 60;

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname() || '';
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false); // when collapsed, hover expands
  const [hydrated, setHydrated] = useState(false);

  // Load persisted collapsed state
  useEffect(() => {
    try {
      const v = localStorage.getItem(COLLAPSED_KEY);
      if (v === '1') setCollapsed(true);
    } catch {}
    setHydrated(true);
  }, []);

  // Listen for the topbar toggle so the two stay in sync
  useEffect(() => {
    const handler = () => {
      try {
        setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1');
      } catch {}
    };
    window.addEventListener('99core:sidebar-toggled', handler);
    return () => window.removeEventListener('99core:sidebar-toggled', handler);
  }, []);

  // Sync sidebar width to a CSS var so .main-wrapper can read it
  useEffect(() => {
    const effectiveCollapsed = collapsed && !hovered;
    const w = effectiveCollapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W_EXPANDED;
    document.documentElement.style.setProperty('--sidebar-w', `${w}px`);
    document.body.classList.toggle('sidebar-collapsed', effectiveCollapsed);
  }, [collapsed, hovered]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role as UserRole);
      })
      .catch(() => {});
  }, []);

  // Auto-expand the group containing the current path
  useEffect(() => {
    navStructure.forEach((entry) => {
      if (entry.type === 'group') {
        const hasActive = entry.children.some(
          (c) => pathname === c.href || pathname.startsWith(c.href + '/')
        );
        if (hasActive) {
          setExpandedGroups((prev) => new Set([...prev, entry.name]));
        }
      }
    });
  }, [pathname]);

  // Close mobile sidebar on route change
  useEffect(() => {
    onMobileClose?.();
  }, [pathname]);

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {}
      window.dispatchEvent(new CustomEvent('99core:sidebar-toggled'));
      return next;
    });
    setHovered(false);
  };

  const canSeeEntry = (entry: NavEntry, role: UserRole | null) => {
    if (!entry.requiredRoles) return true;
    if (!role) return false;
    return entry.requiredRoles.includes(role);
  };

  const canSeeChild = (child: NavChild, role: UserRole | null) => {
    if (!child.requiredRoles) return true;
    if (!role) return false;
    return child.requiredRoles.includes(role);
  };

  const isLinkActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const visibleEntries = navStructure.filter((e) => canSeeEntry(e, userRole));

  // Effective rail vs full presentation. When the user has collapsed the
  // sidebar we still expand it temporarily on hover so they can read labels
  // and click into groups without unpinning.
  const railMode = collapsed && !hovered;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`sidebar ${mobileOpen ? 'sidebar-mobile-open' : ''} ${railMode ? 'sidebar-rail' : ''}`}
        onMouseEnter={() => collapsed && setHovered(true)}
        onMouseLeave={() => collapsed && setHovered(false)}
      >
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/"
              className="flex items-center gap-2.5 min-w-0"
              title="99Core"
            >
              <div
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-white text-[11px] font-semibold tracking-tight"
                style={{ backgroundColor: '#0B1F3A' }}
              >
                99
              </div>
              {!railMode && <h1 className="truncate">99Core</h1>}
            </Link>
            <button
              onClick={onMobileClose}
              className="lg:hidden -mr-1 p-1 text-zinc-400 hover:text-zinc-900"
              aria-label="Close menu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {!railMode && <p className="sidebar-tagline">Operations</p>}
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {visibleEntries.map((entry) => {
            if (entry.type === 'link') {
              return (
                <Link
                  key={entry.name}
                  href={entry.href}
                  className={`sidebar-link ${isLinkActive(entry.href) ? 'active' : ''}`}
                  title={railMode ? entry.name : undefined}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={entry.icon} />
                  </svg>
                  {!railMode && <span>{entry.name}</span>}
                </Link>
              );
            }

            const isExpanded = expandedGroups.has(entry.name);
            const visibleChildren = entry.children.filter((c) => canSeeChild(c, userRole));
            const groupHasActive = visibleChildren.some((c) => isLinkActive(c.href));

            return (
              <div key={entry.name} className="mt-0.5">
                <button
                  onClick={() => {
                    if (railMode) {
                      // In rail mode, expand the sidebar and open the group
                      toggleCollapsed();
                      if (!isExpanded) toggleGroup(entry.name);
                    } else {
                      toggleGroup(entry.name);
                    }
                  }}
                  className={`sidebar-link ${groupHasActive && (!isExpanded || railMode) ? 'active' : ''}`}
                  aria-expanded={isExpanded}
                  title={railMode ? entry.name : undefined}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={entry.icon} />
                  </svg>
                  {!railMode && (
                    <>
                      <span className="flex-1">{entry.name}</span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transition-transform duration-200 opacity-60 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </>
                  )}
                </button>
                {!railMode && isExpanded && (
                  <div className="mt-0.5 ml-[26px] space-y-px">
                    {visibleChildren.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`sidebar-sublink ${isLinkActive(child.href) ? 'active' : ''}`}
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer — collapse toggle + version */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-200/85 px-2 py-2">
          <div className={`flex items-center ${railMode ? 'justify-center' : 'justify-between'} gap-2`}>
            {!railMode && (
              <div className="flex items-center gap-2 px-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                    style={{ backgroundColor: '#14B8A6' }}
                  />
                  <span
                    className="relative inline-flex h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: '#14B8A6' }}
                  />
                </span>
                <p className="text-[10.5px] text-zinc-500">99Core v2.0</p>
              </div>
            )}
            {hydrated && (
              <button
                onClick={toggleCollapsed}
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
