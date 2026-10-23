'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApiKey, type ByokProvider } from '@/hooks/useApiKey';

interface ApiKeyGateProps {
  onKeySet: () => void;  // Called after key is saved so caller can retry the action
  requiresAnthropicOnly?: boolean;  // For agent chat, which needs Anthropic specifically
}

const PROVIDERS: { id: ByokProvider; label: string; placeholder: string; hint: string }[] = [
  { id: 'groq', label: 'Groq', placeholder: 'gsk_...', hint: 'Free tier available at console.groq.com' },
  { id: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...', hint: 'Required for agent chat' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...', hint: 'GPT-4o via platform.openai.com' },
];

export function ApiKeyGate({ onKeySet, requiresAnthropicOnly = false }: ApiKeyGateProps) {
  const { setKey } = useApiKey();
  const [provider, setProvider] = useState<ByokProvider>(requiresAnthropicOnly ? 'anthropic' : 'groq');
  const [keyValue, setKeyValue] = useState('');
  const [error, setError] = useState('');

  const visibleProviders = requiresAnthropicOnly
    ? PROVIDERS.filter(p => p.id === 'anthropic')
    : PROVIDERS;
  const selectedMeta = visibleProviders.find(p => p.id === provider) ?? visibleProviders[0];

  function handleSave() {
    const trimmed = keyValue.trim();
    if (!trimmed) { setError('Enter an API key to continue.'); return; }
    setKey(provider, trimmed);
    setError('');
    onKeySet();
  }

  return (
    <div
      style={{
        background: '#0f172a',
        border: '1px solid #1e3a5f',
        borderRadius: 10,
        padding: '20px 24px',
        maxWidth: 420,
        width: '100%',
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <p style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>
          API Key Required
        </p>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
          {requiresAnthropicOnly
            ? 'Agent chat requires an Anthropic key.'
            : 'Enter your LLM API key to run AI analysis.'}
          {' '}
          <Link href="/login" style={{ color: '#60a5fa', textDecoration: 'underline' }}>
            Sign in
          </Link>{' '}
          for persistent settings.
        </p>
      </div>

      {/* Provider tabs */}
      {!requiresAnthropicOnly && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => { setProvider(p.id); setKeyValue(''); setError(''); }}
              style={{
                flex: 1,
                padding: '6px 4px',
                border: '1px solid',
                borderColor: provider === p.id ? '#2563eb' : '#1e293b',
                borderRadius: 6,
                background: provider === p.id ? '#1e3a5f' : 'transparent',
                color: provider === p.id ? '#93c5fd' : '#64748b',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Key input */}
      <div style={{ marginBottom: 12 }}>
        <input
          type="password"
          value={keyValue}
          onChange={e => { setKeyValue(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
          placeholder={selectedMeta.placeholder}
          autoComplete="off"
          style={{
            width: '100%',
            padding: '9px 12px',
            background: '#020617',
            border: `1px solid ${error ? '#ef4444' : '#1e293b'}`,
            borderRadius: 6,
            color: '#f1f5f9',
            fontSize: 13,
            fontFamily: 'monospace',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
        <p style={{ color: '#475569', fontSize: 11, margin: '4px 0 0', lineHeight: 1.4 }}>
          {selectedMeta.hint} — stored in your browser session only.
        </p>
        {error && <p style={{ color: '#f87171', fontSize: 12, margin: '4px 0 0' }}>{error}</p>}
      </div>

      <button
        onClick={handleSave}
        style={{
          width: '100%',
          padding: '10px',
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#1d4ed8')}
        onMouseLeave={e => (e.currentTarget.style.background = '#2563eb')}
      >
        Save &amp; Continue
      </button>
    </div>
  );
}
