'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import PageBack from './PageBack';

// Routes that should render full-bleed without the sidebar/topbar chrome.
const CHROMELESS_ROUTES = ['/login', '/forgot-password', '/reset-password', '/expenses/capture'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isChromeless = CHROMELESS_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + '/')
  );

  if (isChromeless) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="main-wrapper">
        <Topbar onMenuToggle={() => setMobileMenuOpen((v) => !v)} />
        <main className="main-content">
          <PageBack />
          {children}
        </main>
      </div>
    </>
  );
}
