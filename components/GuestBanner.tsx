'use client';

import Link from 'next/link';
import { useApiKey } from '@/hooks/useApiKey';

export function GuestBanner() {
  const { isGuest, bannerDismissed, dismissBanner } = useApiKey();

  if (!isGuest || bannerDismissed) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: '#0f172a',
        borderBottom: '1px solid #1e3a5f',
        padding: '7px 16px',
        fontSize: 13,
        color: '#94a3b8',
        position: 'relative',
      }}
    >
      <span style={{ color: '#3b82f6', flexShrink: 0 }}>ⓘ</span>
      <span>
        Viewing as guest — AI analysis, agent chat, and spec generation require an API key.{' '}
        <Link
          href="/login"
          style={{ color: '#60a5fa', textDecoration: 'underline', textDecorationColor: '#1e40af' }}
        >
          Sign in
        </Link>
        {' '}for full access.
      </span>
      <button
        onClick={dismissBanner}
        title="Dismiss"
        aria-label="Dismiss guest banner"
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          color: '#475569',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
          padding: '2px 4px',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
        onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
      >
        ×
      </button>
    </div>
  );
}
