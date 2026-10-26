'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const NAV_LINKS = [
  { href: '/programs',     label: 'Programs' },
  { href: '/agents',       label: 'Agents' },
  { href: '/context',      label: 'Context' },
  { href: '/scopes',       label: 'Scopes' },
  { href: '/architecture', label: 'Architecture' },
  { href: '/settings',     label: 'Settings' },
  { href: '/admin',        label: 'Admin' },
];

function deriveBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [];

  const crumbs: { label: string; href?: string }[] = [];
  if (segments[0] === 'programs') {
    crumbs.push({ label: 'Programs', href: '/programs' });
    if (segments[1]) crumbs.push({ label: decodeURIComponent(segments[1]) });
  } else if (segments[0] === 'agents') {
    crumbs.push({ label: 'Agents', href: '/agents' });
    if (segments[1] === 'chat') crumbs.push({ label: 'Chat' });
    else if (segments[1]) crumbs.push({ label: decodeURIComponent(segments[1]) });
  } else {
    const label = segments[0].charAt(0).toUpperCase() + segments[0].slice(1);
    crumbs.push({ label });
  }
  return crumbs;
}

const linkStyle = (active: boolean): React.CSSProperties => ({
  color: active ? '#fff' : 'rgba(255,255,255,0.65)',
  textDecoration: 'none',
  fontSize: 13,
  padding: '5px 10px',
  borderRadius: 6,
  fontWeight: active ? 600 : 400,
  background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
  whiteSpace: 'nowrap' as const,
});

export function AppNavClient({ userEmail, isAuthenticated }: { userEmail?: string | null; isAuthenticated: boolean }) {
  const pathname = usePathname();
  const crumbs = deriveBreadcrumbs(pathname);
  const isHome = pathname === '/' || pathname === '/login';

  return (
    <div style={{ display: 'flex', alignItems: 'center', flex: 1, marginLeft: 20, minWidth: 0, gap: 0 }}>
      {/* Breadcrumbs for deep pages; nav links on home */}
      {!isHome && crumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}>
          <span aria-hidden="true" style={{ opacity: 0.35 }}>/</span>
          {crumbs.map((crumb, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span aria-hidden="true" style={{ opacity: 0.35 }}>/</span>}
              {crumb.href ? (
                <Link href={crumb.href} style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}>
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" style={{ color: '#fff', fontWeight: 600 }}>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : (
        <nav aria-label="Main navigation" style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {NAV_LINKS.map(link => (
            <Link key={link.href} href={link.href} style={linkStyle(pathname.startsWith(link.href))}>
              {link.label}
            </Link>
          ))}
        </nav>
      )}

      <div style={{ flex: 1 }} />

      {userEmail && (
        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginRight: 10, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={userEmail}>
          {userEmail}
        </span>
      )}
      {isAuthenticated ? (
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          aria-label="Sign out"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#FCA5A5', fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 6, cursor: 'pointer' }}
        >
          Sign out
        </button>
      ) : (
        pathname !== '/login' && (
          <Link href="/login" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textDecoration: 'none', padding: '5px 12px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6 }}>
            Sign in
          </Link>
        )
      )}
    </div>
  );
}
