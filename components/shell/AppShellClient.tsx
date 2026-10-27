'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';

interface Props {
  children: React.ReactNode;
  userEmail?: string | null;
  isAdmin: boolean;
}

const SKIP_NAV_ROUTES = new Set(['/login']);

export function AppShellClient({ children, userEmail: serverEmail, isAdmin }: Props) {
  // useSession() is reactive — it updates after client-side signIn/signOut without
  // requiring a full page reload (the root layout doesn't re-render on navigation).
  const { data: session } = useSession();
  const userEmail = session?.user?.email ?? serverEmail;
  const effectiveIsAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin' || isAdmin;
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Skip shell for auth pages
  if (SKIP_NAV_ROUTES.has(pathname)) {
    return <main id="main-content">{children}</main>;
  }

  return (
    <>
      {/* Skip-nav */}
      <a href="#main-content" className="skip-nav">Skip to main content</a>

      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

        {/* Mobile backdrop */}
        {drawerOpen && (
          <div
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
              zIndex: 199, display: 'none',
            }}
            className="shell-backdrop"
          />
        )}

        {/* Side nav — desktop always visible, mobile as drawer */}
        <div
          className="shell-sidenav"
          style={{
            zIndex: 200,
            flexShrink: 0,
            height: '100%',
          }}
        >
          <SideNav
            collapsed={collapsed}
            onToggle={() => setCollapsed(v => !v)}
            isAdmin={effectiveIsAdmin}
            pathname={pathname}
            onNavClick={() => setDrawerOpen(false)}
          />
        </div>

        {/* Right column: TopBar + content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <TopBar
            pathname={pathname}
            userEmail={userEmail}
            onMenuClick={() => setDrawerOpen(v => !v)}
          />
          <main
            id="main-content"
            style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}
          >
            {children}
          </main>
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 767px) {
          .topbar-hamburger { display: flex !important; }
          .shell-sidenav {
            position: fixed !important;
            top: 0; left: 0; height: 100% !important;
            transform: translateX(${drawerOpen ? '0' : '-100%'});
            transition: transform 0.22s ease;
          }
          .shell-backdrop { display: block !important; }
        }
      `}</style>
    </>
  );
}
