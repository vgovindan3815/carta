'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ProgramData, CodeQualityAnalysis, CodeQualityFinding } from '@/lib/parser/types';

interface Props { program: ProgramData }

const SEV_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: '#FEE2E2', text: '#991B1B', label: 'CRITICAL' },
  high:     { bg: '#FEF3C7', text: '#92400E', label: 'HIGH' },
  medium:   { bg: '#EFF6FF', text: '#1E40AF', label: 'MEDIUM' },
  low:      { bg: '#F0FDF4', text: '#166534', label: 'LOW' },
  info:     { bg: '#F8FAFC', text: '#475569', label: 'INFO' },
};

const GRADE_COLOR: Record<string, string> = {
  A: '#166534', B: '#1E40AF', C: '#92400E', D: '#9A3412', F: '#991B1B',
};

function FindingCard({ f }: { f: CodeQualityFinding }) {
  const s = SEV_COLOR[f.severity] ?? SEV_COLOR.info;
  return (
    <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px', marginBottom: 8, background: '#FAFAFA' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ background: s.bg, color: s.text, fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, letterSpacing: '0.05em' }}>
          {s.label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{f.category}</span>
        {f.location && (
          <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto', fontFamily: 'Consolas,monospace' }}>{f.location}</span>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#4B5563', marginBottom: 4 }}>{f.description}</div>
      <div style={{ fontSize: 11, color: '#6366F1', background: '#EEF2FF', padding: '4px 8px', borderRadius: 4 }}>
        💡 {f.recommendation}
      </div>
    </div>
  );
}

function Section({ title, icon, findings, emptyMsg }: { title: string; icon: string; findings: CodeQualityFinding[]; emptyMsg: string }) {
  const [open, setOpen] = useState(true);
  const bySev = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <div style={{ marginBottom: 16, border: '1.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#F9FAFB', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#1F2937', flex: 1 }}>{title}</span>
        <span style={{ fontSize: 11, color: '#6B7280' }}>{findings.length} finding{findings.length !== 1 ? 's' : ''}</span>
        {Object.entries(bySev).map(([sev, n]) => {
          const s = SEV_COLOR[sev] ?? SEV_COLOR.info;
          return <span key={sev} style={{ background: s.bg, color: s.text, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20 }}>{n} {sev}</span>;
        })}
        <span style={{ color: '#9CA3AF', marginLeft: 4 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '10px 14px', background: '#fff' }}>
          {findings.length === 0
            ? <div style={{ color: '#9CA3AF', fontSize: 12, padding: '8px 0' }}>✓ {emptyMsg}</div>
            : findings.map((f, i) => <FindingCard key={i} f={f} />)
          }
        </div>
      )}
    </div>
  );
}

export default function CodeQuality({ program }: Props) {
  const [data, setData] = useState<CodeQualityAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      if (force) {
        const res = await fetch(`/api/programs/${encodeURIComponent(program.name)}/code-quality`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Analysis failed');
        setData(json as CodeQualityAnalysis);
      } else {
        const res = await fetch(`/api/programs/${encodeURIComponent(program.name)}/code-quality`);
        const json = await res.json();
        setData(json as CodeQualityAnalysis | null);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [program.name]);

  // Load cached data on mount
  useEffect(() => { load(false); }, [load]);

  if (!fetched || (loading && !data)) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
        <div>Loading code quality analysis…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 16px', color: '#991B1B', marginBottom: 16 }}>
          {error}
        </div>
        <button onClick={() => load(true)} style={{ padding: '8px 18px', background: '#1F3864', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          Retry Analysis
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: '#1F2937' }}>No code quality analysis yet</div>
        <div style={{ color: '#6B7280', fontSize: 13, marginBottom: 20 }}>
          Run the analysis to detect vulnerabilities, redundancy, standards violations, and performance issues.
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          style={{ padding: '10px 24px', background: '#1F3864', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
        >
          {loading ? 'Analysing…' : 'Run Code Quality Analysis'}
        </button>
      </div>
    );
  }

  const gradeColor = GRADE_COLOR[data.summary?.grade ?? 'F'] ?? '#374151';
  const generatedAt = data.generatedAt ? new Date(data.generatedAt).toLocaleString() : null;

  return (
    <div style={{ padding: 24 }}>
      {/* Summary bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '14px 20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 48, fontWeight: 900, color: gradeColor, lineHeight: 1 }}>{data.summary?.grade ?? '?'}</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#374151' }}>{data.summary?.score ?? 0}<span style={{ fontSize: 13, color: '#9CA3AF' }}>/100</span></span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
            const n = data.summary?.[sev] ?? 0;
            if (n === 0) return null;
            const s = SEV_COLOR[sev];
            return (
              <span key={sev} style={{ background: s.bg, color: s.text, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                {n} {sev}
              </span>
            );
          })}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {generatedAt && <span style={{ fontSize: 11, color: '#9CA3AF' }}>Generated {generatedAt}</span>}
          <button
            onClick={() => load(true)}
            disabled={loading}
            style={{ padding: '6px 14px', background: loading ? '#E5E7EB' : '#1F3864', color: loading ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 700 }}
          >
            {loading ? 'Analysing…' : '↺ Refresh Analysis'}
          </button>
        </div>
      </div>

      {/* Finding sections */}
      <Section
        title="Vulnerabilities"
        icon="🛡️"
        findings={data.vulnerabilities ?? []}
        emptyMsg="No vulnerabilities detected"
      />
      <Section
        title="Code Redundancy"
        icon="♻️"
        findings={data.redundancy ?? []}
        emptyMsg="No redundant code detected"
      />
      <Section
        title="Standards Compliance"
        icon="📐"
        findings={data.standards ?? []}
        emptyMsg="No standards violations detected"
      />
      <Section
        title="Performance"
        icon="⚡"
        findings={data.performance ?? []}
        emptyMsg="No performance issues detected"
      />
    </div>
  );
}
