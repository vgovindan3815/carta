'use client';

import Link from 'next/link';

const NAV_MAIN = [
  { href: '/',             label: 'Home',         icon: '🏠' },
  { href: '/programs',     label: 'Programs',     icon: '📋' },
  { href: '/agents',       label: 'Agents',       icon: '🤖' },
  { href: '/context',      label: 'Context',      icon: '🧠' },
  { href: '/architecture', label: 'Architecture', icon: '🗂' },
];

const NAV_BOTTOM = [
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export interface SideNavProps {
  collapsed: boolean;
  onToggle: () => void;
  isAdmin: boolean;
  pathname: string;
  onNavClick?: () => void;
}

function isActive(href: string, pathname: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export function SideNav({ collapsed, onToggle, isAdmin, pathname, onNavClick }: SideNavProps) {
  const W = collapsed ? 72 : 248;

  const allMain = [
    ...NAV_MAIN,
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: '🛡️' }] : []),
  ];

  function Item({ href, label, icon }: { href: string; label: string; icon: string }) {
    const active = isActive(href, pathname);
    return (
      <Link
        href={href}
        onClick={onNavClick}
        title={collapsed ? label : undefined}
        aria-label={collapsed ? label : undefined}
        aria-current={active ? 'page' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: collapsed ? 0 : 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '11px 0' : '9px 14px',
          borderRadius: 'var(--radius-sm)',
          textDecoration: 'none',
          color: active ? 'var(--mkp-teal-500)' : 'rgba(255,255,255,0.68)',
          background: active ? 'rgba(77,170,199,0.14)' : 'transparent',
          fontWeight: active ? 600 : 400,
          fontSize: 13,
          transition: 'background 0.12s, color 0.12s',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          borderLeft: active && !collapsed ? '3px solid var(--mkp-teal-500)' : '3px solid transparent',
          boxSizing: 'border-box',
        }}
        onMouseEnter={e => {
          if (!active) {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
            (e.currentTarget as HTMLElement).style.color = '#fff';
          }
        }}
        onMouseLeave={e => {
          if (!active) {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.68)';
          }
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
        {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
      </Link>
    );
  }

  return (
    <nav
      aria-label="Main navigation"
      style={{
        width: W,
        flexShrink: 0,
        background: 'linear-gradient(180deg, var(--mkp-navy-800) 0%, var(--mkp-navy-900) 100%)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        transition: 'width 0.2s ease',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        overflow: 'hidden',
      }}
    >
      {/* Logo area */}
      <Link
        href="/"
        onClick={onNavClick}
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 16px',
          gap: 10,
          textDecoration: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 900, fontSize: 15, color: 'var(--mkp-teal-500)', letterSpacing: 1, flexShrink: 0 }}>
          MKP
        </span>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Mainframe Knowledge
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
              Platform
            </div>
          </div>
        )}
      </Link>

      {/* Main nav items */}
      <div style={{ flex: 1, padding: collapsed ? '10px 8px' : '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', overflowX: 'hidden' }}>
        {allMain.map(item => <Item key={item.href} {...item} />)}
      </div>

      {/* Bottom: Settings + collapse toggle */}
      <div style={{ padding: collapsed ? '10px 8px' : '10px 8px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_BOTTOM.map(item => <Item key={item.href} {...item} />)}

        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 10,
            padding: collapsed ? '11px 0' : '9px 14px',
            background: 'none',
            border: '3px solid transparent',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 13,
            width: '100%',
            fontFamily: 'var(--font-body)',
            transition: 'background 0.12s, color 0.12s',
            boxSizing: 'border-box',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)';
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>{collapsed ? '▶' : '◀'}</span>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </nav>
  );
}
