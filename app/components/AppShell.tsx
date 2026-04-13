'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import PageBack from './PageBack';

// Routes that should render full-bleed without the sidebar/topbar chrome.
const CHROMELESS_ROUTES = ['/login', '/forgot-password', '/reset-password', '/expenses/capture'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const isChromeless = CHROMELESS_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + '/')
  );

  if (isChromeless) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="main-content">
          <PageBack />
          {children}
        </main>
      </div>
    </>
  );
}
