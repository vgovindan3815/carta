'use client';

import { useState } from 'react';
import type { ProgramData } from '@/lib/parser/types';

interface Props {
  program: ProgramData;
  onRefreshed?: (updated: ProgramData) => void;
}

function demoNote() {
  alert(
    'Prototype note: This action is illustrative — in the real MAVEN build, this triggers the engineer review and sign-off workflow.'
  );
}

export default function ModernizationSpec({ program: p, onRefreshed }: Props) {
  const s = p.spec;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshLog, setRefreshLog] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshError(null);
    setRefreshLog('Submitting refresh request…');

    try {
      const res = await fetch(`/api/programs/${p.name}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifact: 'spec' }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Server error ${res.status}`);
      }

      setRefreshLog('Generating updated specification… this may take 30–60 s');

      // Poll program endpoint until version increments
      const prevVersion = p.version ?? 1;
      const deadline = Date.now() + 120_000;

      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const pr = await fetch(`/api/programs/${p.name}`);
          if (pr.ok) {
            const updated: ProgramData = await pr.json();
            if ((updated.version ?? 1) > prevVersion) {
              setRefreshLog(null);
              setRefreshing(false);
              onRefreshed?.(updated);
              return;
            }
          }
        } catch {
          // keep polling
        }
      }

      throw new Error('Refresh timed out — check server logs');
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : String(e));
      setRefreshLog(null);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-12 mb-16">
        <div>
          <div className="panel-title">Modernization Spec — {p.name}</div>
          <div className="panel-subtitle" style={{ marginBottom: 0 }}>
            Java-target specification draft. Engineer sign-off required before use.
          </div>
        </div>
        <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          {s.generatedAt && (
            <span style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic' }}>
              Last generated: {s.generatedAt}
            </span>
          )}
          {p.version && p.version > 1 && (
            <span style={{
              background: '#EDE9FE', color: '#7C3AED',
              fontSize: 10, fontWeight: 800,
              padding: '2px 8px', borderRadius: 12,
              fontFamily: 'Consolas, monospace',
            }}>
              v{p.version}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              background: refreshing ? '#E5E7EB' : 'linear-gradient(135deg,#1F3864,#1C7293)',
              color: refreshing ? '#9CA3AF' : '#fff',
              border: 'none', borderRadius: 6,
              padding: '6px 14px', fontSize: 12, fontWeight: 700,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {refreshing ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>↺</span>
                Refreshing…
              </>
            ) : '↺ Refresh Spec'}
          </button>
          <span className="badge badge-draft">
            <span className="badge-dot" />
            Draft — awaiting engineer validation
          </span>
        </div>
      </div>

      {/* Refresh status */}
      {refreshLog && (
        <div style={{ background: '#EBF4FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#1D4ED8', fontWeight: 600 }}>
          ⏳ {refreshLog}
        </div>
      )}
      {refreshError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#DC2626', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✕ {refreshError}</span>
          <button onClick={() => setRefreshError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 16 }}>✕</button>
        </div>
      )}

      <div className="spec-container">
        {/* Draft banner */}
        <div className="draft-banner">
          <div className="draft-banner-icon">⚠</div>
          <div className="draft-banner-text">
            <h3>Draft — requires engineer validation before use</h3>
            <p>
              MAVEN-generated from the deterministic dependency graph and existing business
              rules. An engineer must review, correct, and sign off before this document
              informs any code change or modernisation task.
            </p>
          </div>
        </div>

        {/* Title card */}
        <div
          className="spec-section"
          style={{ padding: '14px 20px', marginBottom: 16 }}
        >
          <div style={{ fontWeight: 700, color: 'var(--navy-dark)', fontSize: 15 }}>
            {s.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.subtitle}</div>
        </div>

        {/* Sections */}
        {s.sections.map((sec) => (
          <div key={sec.num} className="spec-section">
            <h3>
              <span className="spec-num">{sec.num}</span>
              {sec.title}
            </h3>
            <div dangerouslySetInnerHTML={{ __html: sec.content }} />
          </div>
        ))}

        {/* Export row */}
        <div className="spec-export-row">
          <button className="btn btn-ghost btn-sm" onClick={demoNote}>
            Request Engineer Review
          </button>
          <button className="btn btn-ghost btn-sm" onClick={demoNote}>
            Export as DOCX
          </button>
          <button className="btn btn-navy btn-sm" onClick={demoNote}>
            Mark as Validated ✓
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
