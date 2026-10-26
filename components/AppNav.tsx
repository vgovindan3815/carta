import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AppNavClient } from './AppNavClient';

export async function AppNav() {
  const session = await getServerSession(authOptions);

  return (
    <>
      <a href="#main-content" className="skip-nav">
        Skip to main content
      </a>

      <header
        role="banner"
        style={{
          background: 'linear-gradient(135deg, #1F3864 0%, #2E4D7B 60%, #1C7293 100%)',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          aria-label="Mainframe Knowledge Platform — home"
          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}
        >
          <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 900, fontSize: 16, color: '#4DAAC7', letterSpacing: 1 }}>
            MKP
          </span>
          <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} aria-hidden="true" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', lineHeight: 1 }}>
              Mainframe Knowledge Platform
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5, lineHeight: 1, marginTop: 2 }}>
              AI-Powered Mainframe Analysis
            </div>
          </div>
        </Link>

        {/* Client: nav links + breadcrumbs + sign-out */}
        <AppNavClient
          userEmail={session?.user?.email}
          isAuthenticated={!!session}
        />
      </header>
    </>
  );
}
