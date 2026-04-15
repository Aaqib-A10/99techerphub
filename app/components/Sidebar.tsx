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

// Icons
const ICON_DASHBOARD =
  'M3 12l2-2m0 0l7-4 7 4M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6';
const ICON_PEOPLE =
  'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z';
const ICON_BOX =
  'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4';
const ICON_MONEY =
  'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
const ICON_COG =
  'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z';

const navStructure: NavEntry[] = [
  {
    type: 'link',
    name: 'Dashboard',
    href: '/',
    icon: ICON_DASHBOARD,
  },
  {
    type: 'group',
    name: 'Employees',
    icon: ICON_PEOPLE,
    requiredRoles: ['ADMIN', 'HR', 'MANAGER'],
    children: [
      { name: 'All Employees', href: '/employees' },
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

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname() || '';
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [userRole, setUserRole] = useState<UserRole | null>(null);

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

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <div
        className={`sidebar ${mobileOpen ? 'sidebar-mobile-open' : ''}`}
      >
        <div
          className="sidebar-brand"
          style={{
            padding: '24px 20px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 2,
                  height: 32,
                  backgroundColor: '#14B8A6',
                  flexShrink: 0,
                  borderRadius: 1,
                }}
              />
              <h1
                style={{
                  margin: 0,
                  color: '#FFFFFF',
                  fontSize: 20,
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                99 Tech Hub ERP
              </h1>
            </div>
            {/* Mobile close button */}
            <button
              onClick={onMobileClose}
              className="lg:hidden text-white/60 hover:text-white p-1"
              aria-label="Close menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p
            style={{
              margin: '8px 0 0',
              paddingLeft: 12,
              color: 'rgba(255,255,255,0.55)',
              fontSize: 10,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Organizational Tracking
          </p>
        </div>

        <nav className="sidebar-nav">
          {visibleEntries.map((entry) => {
            if (entry.type === 'link') {
              return (
                <Link
                  key={entry.name}
                  href={entry.href}
                  className={`sidebar-link ${isLinkActive(entry.href) ? 'active' : ''}`}
                >
                  <svg
                    className="w-5 h-5 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={entry.icon}
                    />
                  </svg>
                  {entry.name}
                </Link>
              );
            }

            // Group
            const isExpanded = expandedGroups.has(entry.name);
            const visibleChildren = entry.children.filter((c) => canSeeChild(c, userRole));
            const groupHasActive = visibleChildren.some((c) => isLinkActive(c.href));

            return (
              <div key={entry.name}>
                <button
                  onClick={() => toggleGroup(entry.name)}
                  className={`sidebar-link w-full text-left ${groupHasActive ? 'active' : ''}`}
                  aria-expanded={isExpanded}
                >
                  <svg
                    className="w-5 h-5 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={entry.icon}
                    />
                  </svg>
                  <span className="flex-1">{entry.name}</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="pl-8 space-y-1 mt-1 border-l border-slate-700/30 ml-3">
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

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700/50">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></div>
            <p className="text-xs text-slate-400">99 ERP v2.0</p>
          </div>
        </div>
      </div>
    </>
  );
}
