'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApiKey } from '@/hooks/useApiKey';

export function LoginSplash() {
  const router = useRouter();
  const pathname = usePathname();
  const { isGuest, acknowledgeGuest } = useApiKey();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show splash on first unauthenticated visit to program pages if not already acknowledged
    if (!isGuest) {
      setVisible(true);
    }
  }, [isGuest]);

  if (!visible) return null;

  function handleSignIn() {
    router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
  }

  function handleContinueAsGuest() {
    acknowledgeGuest();
    setVisible(false);
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: 16,
          padding: '40px 48px',
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Logo mark */}
        <div style={{ marginBottom: 8 }}>
          <span style={{
            display: 'inline-block',
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.5px',
            color: '#f8fafc',
          }}>
            MKP
          </span>
          <span style={{
            display: 'inline-block',
            marginLeft: 8,
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.15em',
            color: '#3b82f6',
            textTransform: 'uppercase',
            verticalAlign: 'middle',
            paddingBottom: 2,
          }}>
            Mainframe Knowledge Platform
          </span>
        </div>

        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
          Mainframe Analysis &amp; Intelligence — dependency mapping, business rules,
          and modernization planning for your COBOL estate.
        </p>

        {/* Primary CTA */}
        <button
          onClick={handleSignIn}
          style={{
            width: '100%',
            padding: '12px 24px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 16,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1d4ed8')}
          onMouseLeave={e => (e.currentTarget.style.background = '#2563eb')}
        >
          Sign In
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: '#1e293b' }} />
          <span style={{ color: '#475569', fontSize: 12 }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#1e293b' }} />
        </div>

        {/* Guest option */}
        <button
          onClick={handleContinueAsGuest}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            fontSize: 14,
            cursor: 'pointer',
            padding: '4px 0',
            textDecoration: 'underline',
            textDecorationColor: '#334155',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
          onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
        >
          Continue as Guest
        </button>

        <p style={{ color: '#475569', fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
          Some features — AI analysis, agent chat, and spec generation — require an
          account or your own LLM API key.
        </p>
      </div>
    </div>
  );
}
