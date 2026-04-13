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
    requiredRoles: [UserRole.ADMIN, UserRole.HR, UserRole.MANAGER, UserRole.ACCOUNTANT],
    children: [
      { name: 'All Employees', href: '/employees' },
      {
        name: 'Onboarding',
        href: '/onboarding-admin',
        requiredRoles: [UserRole.ADMIN, UserRole.HR],
      },
      {
        name: 'Offer Letters',
        href: '/offer-letters',
        requiredRoles: [UserRole.ADMIN, UserRole.HR],
      },
    ],
  },
  {
    type: 'group',
    name: 'Assets',
    icon: ICON_BOX,
    requiredRoles: [UserRole.ADMIN, UserRole.HR, UserRole.MANAGER],
    children: [
      { name: 'Hardware', href: '/assets' },
      { name: 'Digital Access', href: '/digital-access' },
    ],
  },
  {
    type: 'group',
    name: 'Finance',
    icon: ICON_MONEY,
    children: [
      { name: 'Overview', href: '/finance', requiredRoles: [UserRole.ADMIN, UserRole.ACCOUNTANT] },
      { name: 'Expenses', href: '/expenses' },
      {
        name: 'Payroll',
        href: '/finance/payroll',
        requiredRoles: [UserRole.ADMIN, UserRole.ACCOUNTANT],
      },
      {
        name: 'Salary',
        href: '/finance/salary',
        requiredRoles: [UserRole.ADMIN, UserRole.ACCOUNTANT],
      },
      {
        name: 'Billing Splits',
        href: '/finance/billing',
        requiredRoles: [UserRole.ADMIN, UserRole.ACCOUNTANT],
      },
      {
        name: 'Monthly Reports',
        href: '/finance/reports/monthly',
        requiredRoles: [UserRole.ADMIN, UserRole.ACCOUNTANT],
      },
    ],
  },
  {
    type: 'group',
    name: 'System',
    icon: ICON_COG,
    children: [
      { name: 'Notifications', href: '/notifications' },
      { name: 'Audit Trail', href: '/audit', requiredRoles: [UserRole.ADMIN] },
      {
        name: 'Master Data',
        href: '/master-data',
        requiredRoles: [UserRole.ADMIN, UserRole.HR],
      },
      {
        name: 'User Accounts',
        href: '/settings/users',
        requiredRoles: [UserRole.ADMIN],
      },
      { name: 'Settings', href: '/settings', requiredRoles: [UserRole.ADMIN] },
    ],
  },
];

function canSeeChild(child: NavChild, userRole: UserRole | null): boolean {
  if (!child.requiredRoles) return true;
  if (!userRole) return false;
  return child.requiredRoles.includes(userRole);
}

function canSeeEntry(entry: NavEntry, userRole: UserRole | null): boolean {
  if (entry.type === 'link') {
    if (!entry.requiredRoles) return true;
    if (!userRole) return false;
    return entry.requiredRoles.includes(userRole);
  }
  // For groups: visible if the group's own gate passes AND it has at least one visible child
  if (entry.requiredRoles && (!userRole || !entry.requiredRoles.includes(userRole))) {
    return false;
  }
  return entry.children.some((c) => canSeeChild(c, userRole));
}

function groupContainsPath(group: NavGroup, pathname: string): boolean {
  return group.children.some((c) => {
    if (c.href === '/') return pathname === '/';
    return pathname === c.href || pathname.startsWith(c.href + '/');
  });
}

export default function Sidebar() {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [, setLoading] = useState(true);

  // Fetch current user's role
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUserRole(data.user?.role);
        }
      } catch (err) {
        console.error('Failed to fetch user role:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUserRole();
  }, []);

  // Auto-expand the group containing the current route whenever pathname changes.
  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      for (const entry of navStructure) {
        if (entry.type === 'group' && groupContainsPath(entry, pathname)) {
          next.add(entry.name);
        }
      }
      return next;
    });
  }, [pathname]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  };

  const isLinkActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const visibleEntries = navStructure.filter((e) => canSeeEntry(e, userRole));

  return (
    <div className="sidebar">
      <div
        className="sidebar-brand"
        style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Text-only wordmark — matches the login screen treatment */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* 2px teal "Ledger Line" signature accent */}
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
  );
}
