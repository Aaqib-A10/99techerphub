'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { UserRole } from '@prisma/client';
import { Avi, Glyph, type GlyphName } from './design';

// ============================================================================
// 99Core sidebar (Phase 3 design system)
// Light surface, hairline border, grouped nav under WORKSPACE / FINANCE /
// SYSTEM section labels. Routes + RBAC + collapse persistence are
// unchanged from the previous version — only the visual layer was swapped
// to use design tokens (`bg-core-surface`, `text-core-text2`, etc.) and
// the shared Glyph component instead of inline SVG paths.
// ============================================================================

type NavChild = {
  name: string;
  href: string;
  requiredRoles?: UserRole[];
};

type NavLeaf = {
  type: 'link';
  name: string;
  href: string;
  icon: GlyphName;
  requiredRoles?: UserRole[];
};

type NavGroup = {
  type: 'group';
  name: string;
  icon: GlyphName;
  requiredRoles?: UserRole[];
  children: NavChild[];
};

type NavEntry = NavLeaf | NavGroup;

interface NavSection {
  label: string;
  items: NavEntry[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Workspace',
    items: [
      { type: 'link', name: 'Dashboard', href: '/', icon: 'grid' },
      { type: 'link', name: 'Org Chart', href: '/org-chart', icon: 'users' },
      // Self-service catalog — visible to every signed-in user. Employees
      // request access from here; admins manage the queue under System.
      { type: 'link', name: 'Access Catalog', href: '/access-catalog', icon: 'package' },
      {
        type: 'group',
        name: 'Employees',
        icon: 'users',
        requiredRoles: ['ADMIN', 'HR', 'MANAGER'],
        children: [
          { name: 'All Employees', href: '/employees' },
          { name: 'Roles & Responsibilities', href: '/people/responsibilities' },
          // Compensation lives under Employees (not Finance) because it's
          // pure HR record-keeping with no ledger/expense integration.
          // Accountants need read access for exports — gating handled
          // server-side in the route, not here.
          {
            name: 'Compensation',
            href: '/people/compensation',
            requiredRoles: ['ADMIN', 'HR', 'ACCOUNTANT'],
          },
          {
            name: 'Cost by Company',
            href: '/people/compensation/cost-by-company',
            requiredRoles: ['ADMIN', 'HR', 'ACCOUNTANT'],
          },
          { name: 'Onboarding', href: '/onboarding-admin' },
          { name: 'Offer Letters', href: '/offer-letters' },
        ],
      },
      {
        type: 'group',
        name: 'Assets',
        icon: 'box',
        requiredRoles: ['ADMIN', 'HR'],
        children: [
          { name: 'All Assets', href: '/assets' },
          { name: 'Digital Access', href: '/digital-access' },
          { name: 'Access Requests', href: '/access-requests' },
        ],
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        type: 'group',
        name: 'Finance',
        icon: 'card',
        requiredRoles: ['ADMIN', 'ACCOUNTANT', 'MANAGER'],
        // Slimmed-down v1 of Finance. Salary / Commissions / Deductions /
        // Cost Splits / Payroll routes still exist (code untouched at
        // /finance/{salary,commissions,deductions,billing,payroll}) — they
        // just don't show in the sidebar yet. Restore by re-adding the
        // entries here when the company is ready to use them.
        children: [
          { name: 'Overview', href: '/finance' },
          { name: 'Master Ledger', href: '/finance/ledger' },
          { name: 'Expenses', href: '/expenses' },
          { name: 'Reports', href: '/finance/reports' },
        ],
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        type: 'group',
        name: 'System',
        icon: 'settings',
        requiredRoles: ['ADMIN'],
        children: [
          { name: 'Users & Access', href: '/settings/users', requiredRoles: ['ADMIN'] },
          { name: 'Master Data', href: '/master-data' },
          { name: 'Audit Trail', href: '/audit' },
          { name: 'Settings', href: '/settings' },
        ],
      },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const COLLAPSED_KEY = '99core.sidebar.collapsed';
const SIDEBAR_W_EXPANDED = 232;
const SIDEBAR_W_COLLAPSED = 60;

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname() || '';
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<{ email?: string; role?: UserRole } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(COLLAPSED_KEY);
      if (v === '1') setCollapsed(true);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    const handler = () => {
      try {
        setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1');
      } catch {}
    };
    window.addEventListener('99core:sidebar-toggled', handler);
    return () => window.removeEventListener('99core:sidebar-toggled', handler);
  }, []);

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
        if (data?.user) setUser({ email: data.user.email, role: data.user.role });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    NAV_SECTIONS.forEach((section) => {
      section.items.forEach((entry) => {
        if (entry.type === 'group') {
          const hasActive = entry.children.some(
            (c) => pathname === c.href || pathname.startsWith(c.href + '/'),
          );
          if (hasActive) {
            setExpandedGroups((prev) => new Set([...prev, entry.name]));
          }
        }
      });
    });
  }, [pathname]);

  useEffect(() => {
    onMobileClose?.();
  }, [pathname]);

  const toggleGroup = (name: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

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

  const role = user?.role ?? null;
  const canSeeEntry = (entry: NavEntry) =>
    !entry.requiredRoles || (role !== null && entry.requiredRoles.includes(role));
  const canSeeChild = (child: NavChild) =>
    !child.requiredRoles || (role !== null && child.requiredRoles.includes(role));

  const isLinkActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const railMode = collapsed && !hovered;
  const userInitial = (user?.email ?? 'A').charAt(0).toUpperCase();
  const userLabel = user?.email ? user.email.split('@')[0] : 'admin';

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`sidebar ${mobileOpen ? 'sidebar-mobile-open' : ''} flex flex-col bg-core-surface border-r border-core-border text-core-text`}
        onMouseEnter={() => collapsed && setHovered(true)}
        onMouseLeave={() => collapsed && setHovered(false)}
      >
        {/* Brand */}
        <div className="flex items-center border-b border-core-border px-4 py-[14px]">
          <Link
            href="/"
            className="flex min-w-0 flex-1 items-center gap-[11px]"
            title="99Core"
          >
            <div
              className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[9px] text-[12.5px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #A8D45A, #6FA024)',
                boxShadow:
                  '0 1px 0 rgba(0,0,0,.06), inset 0 1px 0 rgba(255,255,255,.25)',
              }}
            >
              99
            </div>
            {!railMode && (
              <div className="min-w-0">
                <div
                  className="truncate text-[13.5px] font-semibold leading-tight text-core-text"
                  style={{ letterSpacing: '-0.01em' }}
                >
                  99Core
                </div>
                <div
                  className="mt-[2px] truncate text-[9.5px] font-semibold uppercase text-core-text3"
                  style={{ letterSpacing: '0.09em' }}
                >
                  Asset &amp; people ops
                </div>
              </div>
            )}
          </Link>
          <button
            onClick={onMobileClose}
            className="-mr-1 ml-2 p-1 text-core-text3 hover:text-core-text lg:hidden"
            aria-label="Close menu"
          >
            <Glyph name="check" size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav
          className={`flex-1 overflow-y-auto py-3 ${railMode ? 'px-[8px]' : 'px-2'}`}
        >
          {NAV_SECTIONS.map((section, sIdx) => {
            const visibleItems = section.items.filter(canSeeEntry);
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.label} className={sIdx > 0 ? 'mt-3' : ''}>
                {!railMode && (
                  <div
                    className="px-3 pb-[6px] pt-[8px] text-[10px] font-semibold uppercase text-core-text3"
                    style={{ letterSpacing: '0.09em' }}
                  >
                    {section.label}
                  </div>
                )}
                {railMode && sIdx > 0 && (
                  <div className="mx-2 my-2 h-px bg-core-border" />
                )}
                <div className="flex flex-col gap-[1px]">
                  {visibleItems.map((entry) => {
                    if (entry.type === 'link') {
                      const active = isLinkActive(entry.href);
                      return (
                        <Link
                          key={entry.name}
                          href={entry.href}
                          title={railMode ? entry.name : undefined}
                          className={navItemClasses(active, railMode)}
                        >
                          <Glyph name={entry.icon} size={15} />
                          {!railMode && <span>{entry.name}</span>}
                        </Link>
                      );
                    }

                    const isExpanded = expandedGroups.has(entry.name);
                    const visibleChildren = entry.children.filter(canSeeChild);
                    const groupHasActive = visibleChildren.some((c) =>
                      isLinkActive(c.href),
                    );
                    const showActive = groupHasActive && (!isExpanded || railMode);

                    return (
                      <div key={entry.name}>
                        <button
                          type="button"
                          onClick={() => {
                            if (railMode) {
                              toggleCollapsed();
                              if (!isExpanded) toggleGroup(entry.name);
                            } else {
                              toggleGroup(entry.name);
                            }
                          }}
                          aria-expanded={isExpanded}
                          title={railMode ? entry.name : undefined}
                          className={navItemClasses(showActive, railMode)}
                        >
                          <Glyph name={entry.icon} size={15} />
                          {!railMode && (
                            <>
                              <span className="flex-1 text-left">{entry.name}</span>
                              <Glyph
                                name={isExpanded ? 'chevronDown' : 'chevronRight'}
                                size={11}
                                className="text-core-text3"
                              />
                            </>
                          )}
                        </button>
                        {!railMode && isExpanded && (
                          <div className="mt-[1px] flex flex-col gap-[1px]">
                            {visibleChildren.map((child) => {
                              const childActive = isLinkActive(child.href);
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className={`flex items-center rounded-lg py-[7px] pl-[37px] pr-[11px] text-[12.5px] transition ${
                                    childActive
                                      ? 'bg-core-surface2 font-semibold text-core-text'
                                      : 'font-medium text-core-text2 hover:bg-core-surface2 hover:text-core-text'
                                  }`}
                                >
                                  {child.name}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-core-border px-3 py-[10px]">
          <div
            className={`flex items-center gap-[10px] ${
              railMode ? 'justify-center' : ''
            }`}
          >
            <Avi
              seed={user?.email ?? userLabel}
              initials={userInitial}
              size={28}
            />
            {!railMode && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold leading-tight text-core-text">
                  {userLabel}
                </div>
                <div className="mt-[2px] truncate text-[10.5px] text-core-text3">
                  {user?.role
                    ? user.role.charAt(0) + user.role.slice(1).toLowerCase()
                    : 'Member'}
                </div>
              </div>
            )}
            {hydrated && !railMode && (
              <button
                onClick={toggleCollapsed}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-core-text3 transition hover:bg-core-surface2 hover:text-core-text"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <Glyph name="chevronRight" size={14} className="rotate-180" />
              </button>
            )}
          </div>
          {railMode && hydrated && (
            <button
              onClick={toggleCollapsed}
              className="mt-2 flex w-full items-center justify-center rounded-md py-1 text-core-text3 transition hover:bg-core-surface2 hover:text-core-text"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <Glyph name="chevronRight" size={14} />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

function navItemClasses(active: boolean, rail: boolean): string {
  const base = `flex w-full items-center rounded-lg text-[12.5px] transition ${
    rail
      ? 'h-9 justify-center px-0'
      : 'gap-[11px] px-[11px] py-[8px]'
  }`;
  const stateClasses = active
    ? 'bg-core-surface2 font-semibold text-core-text'
    : 'font-medium text-core-text2 hover:bg-core-surface2 hover:text-core-text';
  return `${base} ${stateClasses}`;
}
