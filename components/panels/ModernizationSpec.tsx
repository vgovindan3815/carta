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
  const hasSpec = s.sections.length > 0;
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
      <div style={{ borderBottom: '2px solid var(--navy-dark)', paddingBottom: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
              Modernization Brief
            </div>
            <div className="panel-title" style={{ marginBottom: 4 }}>
              {p.name} — {hasSpec ? 'Modernization Brief' : 'Generate Brief'}
            </div>
            <div className="panel-subtitle" style={{ marginBottom: 0 }}>
              {hasSpec
                ? 'On-demand modernization brief. Engineer review and sign-off required before use.'
                : 'Generate a Modernization Brief to plan enhancement or migration of this program.'}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            {hasSpec && s.generatedAt && (
              <span style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic' }}>
                Generated: {s.generatedAt}
              </span>
            )}
            {hasSpec && p.version && p.version > 1 && (
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
                  Generating…
                </>
              ) : hasSpec ? '↺ Regenerate Brief' : '⚡ Generate Modernization Brief'}
            </button>
            {hasSpec && (
              <span className="badge badge-draft">
                <span className="badge-dot" />
                Draft — awaiting engineer validation
              </span>
            )}
          </div>
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

      {!hasSpec ? (
        /* Empty state CTA */
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '60px 40px', textAlign: 'center',
          background: '#F8FAFD', border: '2px dashed #C7D2FE', borderRadius: 12,
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy-dark)', marginBottom: 10 }}>
            No Modernization Brief Yet
          </div>
          <div style={{ fontSize: 13, color: '#6B7280', maxWidth: 480, lineHeight: 1.7, marginBottom: 24 }}>
            The Modernization Brief is generated on-demand — most useful when planning a
            mainframe enhancement or migration. It recommends one of four methods, produces
            a phased sequence (strangler-fig or leaf-first), behavior contract, and approval block.
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 32 }}>
            {[
              { icon: '⬆', label: 'Uplift', desc: 'Same-stack version bump' },
              { icon: '🔧', label: 'Refactor', desc: 'In-place COBOL restructuring' },
              { icon: '↔', label: 'Transform', desc: 'Rewrite to Java / Node.js' },
              { icon: '✦', label: 'Reimagine', desc: 'Greenfield rebuild' },
            ].map((m) => (
              <div key={m.label} style={{
                background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
                padding: '12px 20px', minWidth: 140,
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy-dark)' }}>{m.label}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{m.desc}</div>
              </div>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              background: refreshing ? '#E5E7EB' : 'linear-gradient(135deg,#1F3864,#1C7293)',
              color: refreshing ? '#9CA3AF' : '#fff',
              border: 'none', borderRadius: 8,
              padding: '10px 28px', fontSize: 14, fontWeight: 700,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {refreshing ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>↺</span>
                Generating Brief…
              </>
            ) : '⚡ Generate Modernization Brief'}
          </button>
        </div>
      ) : (
        <div className="spec-container">
          {/* Draft banner */}
          <div className="draft-banner">
            <div className="draft-banner-icon">⚠</div>
            <div className="draft-banner-text">
              <h3>Draft — requires engineer validation before use</h3>
              <p>
                MAVEN-generated from the deterministic dependency graph and extracted business
                rules. An engineer must review and sign off before this brief informs any
                code change or modernisation task.
              </p>
            </div>
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
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
