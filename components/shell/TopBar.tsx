'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { deriveBreadcrumbs, pageTitle } from '@/lib/breadcrumbs';

interface TopBarProps {
  pathname: string;
  userEmail?: string | null;
  onMenuClick: () => void;
}

export function TopBar({ pathname, userEmail, onMenuClick }: TopBarProps) {
  const crumbs = deriveBreadcrumbs(pathname);
  const title  = pageTitle(pathname);

  return (
    <header
      role="banner"
      style={{
        height: 64,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 24px',
        background: 'var(--surface-card)',
        borderBottom: '1px solid var(--border-default)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Mobile hamburger */}
      <button
        aria-label="Open navigation"
        onClick={onMenuClick}
        style={{
          display: 'none',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 8,
          color: 'var(--text-primary)',
          fontSize: 20,
          lineHeight: 1,
          borderRadius: 'var(--radius-sm)',
        }}
        className="topbar-hamburger"
      >
        ☰
      </button>

      {/* Breadcrumbs + title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {crumbs.length > 0 ? (
          <nav aria-label="Breadcrumb">
            <ol style={{ display: 'flex', alignItems: 'center', gap: 6, listStyle: 'none', margin: 0, padding: 0 }}>
              {crumbs.map((crumb, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {i > 0 && <span style={{ color: 'var(--text-secondary)', fontSize: 12 }} aria-hidden="true">/</span>}
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}
                      onMouseEnter={e => ((e.target as HTMLElement).style.color = 'var(--mkp-blue-600)')}
                      onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--text-secondary)')}
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      aria-current="page"
                      style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : (
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>
            {title}
          </h1>
        )}
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {userEmail && (
          <span style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            background: 'var(--surface-subtle)',
            border: '1px solid var(--border-default)',
            borderRadius: 20,
            padding: '4px 12px',
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {userEmail}
          </span>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          aria-label="Sign out"
          style={{
            background: 'none',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 14px',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            transition: 'background 0.12s, color 0.12s, border-color 0.12s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.06)';
            (e.currentTarget as HTMLElement).style.color = 'var(--mkp-red-600)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(220,38,38,0.3)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'none';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)';
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
