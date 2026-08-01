'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { LLMProvider } from '@/lib/llm/types';

const PROVIDERS: {
  id: LLMProvider;
  name: string;
  icon: string;
  color: string;
  borderColor: string;
  bgColor: string;
  status: 'ready' | 'needs-key';
  note: string;
}[] = [
  {
    id: 'groq',
    name: 'Groq',
    icon: '⚡',
    color: '#F97316',
    borderColor: '#FED7AA',
    bgColor: '#FFF7ED',
    status: 'ready',
    note: 'Ultra-fast inference · Free tier 100K tokens/day',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    color: '#10A37F',
    borderColor: '#A7F3D0',
    bgColor: '#F0FDF4',
    status: 'needs-key',
    note: 'Requires paid OpenAI API key · ~$5 per 1M tokens',
  },
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    icon: '🔷',
    color: '#7C3AED',
    borderColor: '#DDD6FE',
    bgColor: '#F5F3FF',
    status: 'needs-key',
    note: 'Requires Anthropic API key · Prompt caching enabled',
  },
];

const PROVIDER_MODELS: Record<LLMProvider, { id: string; label: string; default?: true }[]> = {
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 · Fastest' },
    { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 · Recommended', default: true },
    { id: 'claude-opus-5', label: 'Opus 5 · Most capable' },
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o mini · Fastest' },
    { id: 'gpt-4o', label: 'GPT-4o · Recommended', default: true },
    { id: 'o3', label: 'o3 · Most capable' },
  ],
  groq: [
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1-8B · Fastest' },
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3-70B · Recommended', default: true },
    { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 · Reasoning' },
  ],
};

function defaultModelFor(p: LLMProvider) {
  return PROVIDER_MODELS[p].find((m) => m.default)?.id ?? PROVIDER_MODELS[p][0].id;
}

export default function SettingsPage() {
  const [provider, setProvider] = useState<LLMProvider>('groq');
  const [model, setModel] = useState<string>('');
  // Key inputs are always blank on load — server never returns actual key values
  const [groqKey, setGroqKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  // Whether a key is already saved server-side (shown as a status badge, not the key itself)
  const [groqKeySet, setGroqKeySet] = useState(false);
  const [openaiKeySet, setOpenaiKeySet] = useState(false);
  const [anthropicKeySet, setAnthropicKeySet] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        const p: LLMProvider = data.provider ?? 'groq';
        setProvider(p);
        setModel(data.model || defaultModelFor(p));
        // Only set the "configured" flags — never populate the actual key inputs
        setGroqKeySet(!!data.groqKeySet);
        setOpenaiKeySet(!!data.openaiKeySet);
        setAnthropicKeySet(!!data.anthropicKeySet);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleProviderChange(p: LLMProvider) {
    setProvider(p);
    setModel(defaultModelFor(p));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only send a key field if the user actually typed something — blank = keep existing
        body: JSON.stringify({
          provider,
          model,
          ...(groqKey.trim() ? { groqKey } : {}),
          ...(openaiKey.trim() ? { openaiKey } : {}),
          ...(anthropicKey.trim() ? { anthropicKey } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
      // After saving, refresh configured flags and clear the typed values
      const refreshed = await fetch('/api/settings').then((r) => r.json());
      setGroqKeySet(!!refreshed.groqKeySet);
      setOpenaiKeySet(!!refreshed.openaiKeySet);
      setAnthropicKeySet(!!refreshed.anthropicKeySet);
      setGroqKey(''); setOpenaiKey(''); setAnthropicKey('');
      const activeModel = PROVIDER_MODELS[provider].find((m2) => m2.id === model)?.label ?? model;
      setMessage({ type: 'success', text: `Saved. Active: ${PROVIDERS.find((p2) => p2.id === provider)?.name} · ${activeModel.split('·')[0].trim()}` });
    } catch (e: unknown) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  function toggleShow(key: string) {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const keySetMap: Record<LLMProvider, boolean> = {
    groq: groqKeySet,
    openai: openaiKeySet,
    anthropic: anthropicKeySet,
  };

  const activeProviderMeta = PROVIDERS.find((p) => p.id === provider)!;
  const activeModelLabel = PROVIDER_MODELS[provider].find((m2) => m2.id === model)?.label ?? model;

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FA', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #1F3864 0%, #2E4D7B 60%, #1C7293 100%)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 900, fontSize: 18, color: '#4DAAC7', letterSpacing: 2 }}>MAVEN</span>
          <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', lineHeight: 1 }}>CARTA</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5 }}>Mainframe Intelligence</div>
          </div>
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>/</span>
        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>LLM Settings</span>
        <div style={{ flex: 1 }} />
        <Link href="/programs" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textDecoration: 'none', padding: '4px 12px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6 }}>
          ← Program Knowledge Base
        </Link>
      </header>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px', width: '100%' }}>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1F3864', margin: '0 0 4px' }}>LLM Provider Settings</h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 28px' }}>
          Choose which AI model powers MAVEN analysis. The active provider and model are used for all new analyses.
        </p>

        {/* Feedback banner */}
        {message && (
          <div style={{
            background: message.type === 'success' ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${message.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
            color: message.type === 'success' ? '#16A34A' : '#DC2626',
            borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>{message.type === 'success' ? '✓' : '✕'}</span>
            {message.text}
            <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: 14 }}>✕</button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', fontSize: 14 }}>Loading settings…</div>
        ) : (
          <>
            {/* Provider cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              {PROVIDERS.map((p) => {
                const isActive = provider === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleProviderChange(p.id)}
                    style={{
                      background: isActive ? p.bgColor : '#fff',
                      border: `2px solid ${isActive ? p.color : '#E5E7EB'}`,
                      borderRadius: 12,
                      padding: '20px 16px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}
                  >
                    {isActive && (
                      <div style={{
                        position: 'absolute', top: 10, right: 10,
                        background: p.color, color: '#fff',
                        fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                      }}>ACTIVE</div>
                    )}
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{p.icon}</div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#1F2937', marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5 }}>{p.note}</div>
                    {keySetMap[p.id] ? (
                      <div style={{ marginTop: 8, fontSize: 10, color: '#16A34A', fontWeight: 600 }}>✓ API key configured</div>
                    ) : p.status === 'needs-key' && (
                      <div style={{ marginTop: 8, fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>⚠ API key required</div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Model selector for active provider */}
            <div style={{ background: '#fff', border: `1.5px solid ${activeProviderMeta.borderColor}`, borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1F2937', marginBottom: 4 }}>
                {activeProviderMeta.icon} {activeProviderMeta.name} — Select Model
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>
                Higher-tier models improve analysis quality but cost more tokens.
                {provider === 'anthropic' && ' Prompt caching is enabled for all Claude models — repeated calls share the system prompt cache.'}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PROVIDER_MODELS[provider].map((m2) => {
                  const isSelected = model === m2.id;
                  return (
                    <button
                      key={m2.id}
                      onClick={() => setModel(m2.id)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: `2px solid ${isSelected ? activeProviderMeta.color : '#E5E7EB'}`,
                        background: isSelected ? activeProviderMeta.bgColor : '#FAFAFA',
                        color: isSelected ? activeProviderMeta.color : '#374151',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {m2.default && <span style={{ fontSize: 10, opacity: 0.6 }}>★</span>}
                      {m2.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ height: 1, flex: 1, background: '#E5E7EB' }} />
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                API Keys
              </div>
              <div style={{ height: 1, flex: 1, background: '#E5E7EB' }} />
            </div>

            {/* API Key inputs */}
            <div style={{ background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
              {PROVIDERS.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    padding: '18px 20px',
                    borderTop: i === 0 ? 'none' : '1px solid #F3F4F6',
                    background: provider === p.id ? p.bgColor : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 16 }}>{p.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1F2937' }}>{p.name}</span>
                    {provider === p.id && (
                      <span style={{ background: p.color, color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20 }}>ACTIVE</span>
                    )}
                    <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto', fontFamily: 'Consolas,monospace' }}>
                      {provider === p.id ? (PROVIDER_MODELS[p.id].find((m2) => m2.id === model)?.label ?? model).split('·')[0].trim() : PROVIDER_MODELS[p.id].find((m2) => m2.default)?.label?.split('·')[0].trim()}
                    </span>
                  </div>

                  {p.id === 'groq' && (
                    <KeyInput
                      value={groqKey}
                      onChange={setGroqKey}
                      show={showKeys.groq}
                      onToggle={() => toggleShow('groq')}
                      placeholder="gsk_… (enter new key, or leave blank to keep existing)"
                      hint="Free tier: 100K tokens/day · console.groq.com/keys"
                      isSet={groqKeySet}
                    />
                  )}
                  {p.id === 'openai' && (
                    <KeyInput
                      value={openaiKey}
                      onChange={setOpenaiKey}
                      show={showKeys.openai}
                      onToggle={() => toggleShow('openai')}
                      placeholder="sk-… (enter new key, or leave blank to keep existing)"
                      hint="platform.openai.com/api-keys"
                      isSet={openaiKeySet}
                    />
                  )}
                  {p.id === 'anthropic' && (
                    <KeyInput
                      value={anthropicKey}
                      onChange={setAnthropicKey}
                      show={showKeys.anthropic}
                      onToggle={() => toggleShow('anthropic')}
                      placeholder="sk-ant-… (enter new key, or leave blank to keep existing)"
                      hint="console.anthropic.com/settings/keys · Prompt caching enabled by default"
                      isSet={anthropicKeySet}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Current selection summary */}
            <div style={{ background: '#EBF4FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>{activeProviderMeta.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8' }}>
                  Active: {activeProviderMeta.name} · {activeModelLabel.split('·')[0].trim()}
                </div>
                <div style={{ fontSize: 11, color: '#3B82F6' }}>
                  All new analyses will use this provider and model. Existing cached results are unaffected.
                </div>
              </div>
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: saving ? '#9CA3AF' : 'linear-gradient(135deg, #1F3864, #1C7293)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 28px',
                fontSize: 14,
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                letterSpacing: 0.3,
              }}
            >
              {saving ? 'Saving…' : '✓ Save Settings'}
            </button>

            {/* Security note */}
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 16, lineHeight: 1.6 }}>
              API keys are stored in Neon PostgreSQL. They are not transmitted to third parties and are only used server-side to make LLM API calls. For production use, consider encrypting keys at rest.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function KeyInput({
  value, onChange, show, onToggle, placeholder, hint, isSet,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
  hint: string;
  isSet?: boolean;
}) {
  return (
    <div>
      {isSet && !value && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>✓ API key is configured</span>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>— enter a new key below to replace it</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            border: `1.5px solid ${isSet && !value ? '#BBF7D0' : '#E5E7EB'}`,
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 12,
            fontFamily: 'Consolas, monospace',
            color: '#1F2937',
            outline: 'none',
            background: isSet && !value ? '#F0FDF4' : '#FAFAFA',
          }}
        />
        <button
          type="button"
          onClick={onToggle}
          style={{ background: '#F3F4F6', border: '1.5px solid #E5E7EB', borderRadius: 6, padding: '8px 12px', fontSize: 12, cursor: 'pointer', color: '#6B7280', whiteSpace: 'nowrap' }}
        >
          {show ? '🙈 Hide' : '👁 Show'}
        </button>
      </div>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, paddingLeft: 2 }}>{hint}</div>
    </div>
  );
}
