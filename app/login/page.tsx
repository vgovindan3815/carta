'use client';
import { signIn } from 'next-auth/react';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const router                    = useRouter();
  const searchParams              = useSearchParams();
  const callbackUrl               = searchParams.get('callbackUrl') ?? '/';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (result?.ok) {
      router.push(callbackUrl);
    } else {
      setError('Incorrect email or password. Try again.');
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.15s',
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      style={{
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 16,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 380,
      }}
    >
      {/* Logo mark */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 900, fontSize: 22, color: '#4DAAC7', letterSpacing: 2 }}>MKP</span>
        </div>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>Sign in</h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>Mainframe Knowledge Platform</p>
      </div>

      {/* Error */}
      <div
        role="alert"
        aria-live="polite"
        style={{ minHeight: 36, marginBottom: error ? 16 : 0 }}
      >
        {error && (
          <div style={{ background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.5)', color: '#FCA5A5', borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>

      {/* Email */}
      <div style={{ marginBottom: 14 }}>
        <label htmlFor="login-email" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginBottom: 5 }}>
          Email
        </label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
          required
          placeholder="you@company.com"
          style={inputStyle}
          onFocus={e => (e.target.style.borderColor = '#4DAAC7')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.2)')}
        />
      </div>

      {/* Password */}
      <div style={{ marginBottom: 24 }}>
        <label htmlFor="login-password" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginBottom: 5 }}>
          Password
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="login-password"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            style={{ ...inputStyle, paddingRight: 44 }}
            onFocus={e => (e.target.style.borderColor = '#4DAAC7')}
            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.2)')}
          />
          <button
            type="button"
            aria-label={showPw ? 'Hide password' : 'Show password'}
            onClick={() => setShowPw(v => !v)}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: 4,
            }}
          >
            {showPw ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px',
          background: loading ? 'rgba(28,114,147,0.5)' : 'linear-gradient(135deg, #1C7293, #4DAAC7)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          transition: 'opacity 0.15s',
        }}
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, #0B2044 0%, #0F3460 40%, #1C7293 100%)',
      padding: 24,
    }}>
      <Suspense fallback={<div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
