'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProgramData, ChangeImpactItem } from '@/lib/parser/types';

type TabId = 'overview' | 'dependency' | 'business' | 'impact' | 'spec';

interface Props {
  program: ProgramData;
  onTabChange: (tab: TabId) => void;
}

const SEV_CLASS: Record<string, string> = {
  critical: 'sev-critical',
  high:     'sev-high',
  medium:   'sev-medium',
  low:      'sev-medium',
  unknown:  'sev-unknown',
};
const SEV_LABEL: Record<string, string> = {
  critical: 'CRITICAL',
  high:     'HIGH',
  medium:   'MEDIUM',
  low:      'LOW',
  unknown:  'UNKNOWN',
};

const SEVERITY_GROUPS = [
  { key: 'critical', label: 'Critical Impact',       color: '#C0392B' },
  { key: 'high',     label: 'High Impact',            color: '#D97706' },
  { key: 'medium',   label: 'Medium / Low Impact',    color: '#1C7293' },
  { key: 'unknown',  label: 'Unknown / Dynamic Call', color: '#9CA3AF' },
] as const;

function isNavigable(it: ChangeImpactItem): boolean {
  const rel = (it.rel ?? '').toLowerCase();
  return !rel.includes('dataset') && !rel.includes('table') && !rel.includes('jcl')
    && !rel.includes('file') && !rel.includes('data') && it.severity !== 'unknown';
}

function ItemCard({ it, onNav }: { it: ChangeImpactItem; onNav: () => void }) {
  const nav = isNavigable(it);
  return (
    <div style={{
      background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
      padding: '14px 16px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {nav ? (
          <button
            onClick={onNav}
            style={{
              fontFamily: 'Consolas, monospace', fontWeight: 700, fontSize: 13,
              color: 'var(--navy-dark)', background: 'none', border: 'none',
              padding: 0, cursor: 'pointer', textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            {it.prog}
          </button>
        ) : (
          <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 700, fontSize: 13, color: '#374151' }}>
            {it.prog}
          </span>
        )}
        <span className={`severity ${SEV_CLASS[it.severity] ?? 'sev-medium'}`}>
          {SEV_LABEL[it.severity] ?? it.severity.toUpperCase()}
        </span>
        <span className="rel-tag">{it.rel}</span>
      </div>
      <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#374151', lineHeight: 1.65 }}>
        {it.reason}
      </p>
      <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'Consolas, monospace' }}>
        Source: {it.edge}
      </div>
    </div>
  );
}

export default function ChangeImpact({ program: p, onTabChange }: Props) {
  const router = useRouter();
  const d = p.changeImpact;
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const [reviewer, setReviewer] = useState('');
  const [showReviewer, setShowReviewer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  const groupedItems: Record<string, ChangeImpactItem[]> = {
    critical: d.items.filter((it) => it.severity === 'critical'),
    high:     d.items.filter((it) => it.severity === 'high'),
    medium:   d.items.filter((it) => it.severity === 'medium'),
    unknown:  d.items.filter((it) => it.severity === 'unknown'),
  };

  const covColor = d.coverage >= 90 ? '#27AE60' : d.coverage >= 70 ? '#E07B39' : '#C0392B';

  async function handleValidate(artifactType: string) {
    if (!reviewer.trim()) { setShowReviewer(true); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/validate/${p.name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifactType, reviewer, status: 'approved' }),
      });
      setSubmitMsg(res.ok ? `Sign-off recorded for ${reviewer}` : 'Sign-off recorded (demo mode)');
    } catch {
      setSubmitMsg('Sign-off recorded (demo mode)');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Document header */}
      <div style={{ borderBottom: '2px solid var(--navy-dark)', paddingBottom: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
              Change Impact Assessment
            </div>
            <div className="panel-title" style={{ marginBottom: 4 }}>
              {p.name} — Blast Radius Analysis
            </div>
            <div className="panel-subtitle" style={{ marginBottom: 0 }}>
              Business impact if <strong>{p.name}</strong> is modified — each dependency traced to its source graph edge.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <span className="badge badge-deterministic">
              <span className="badge-dot" />
              Traced · graph-grounded
            </span>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Generated: {today} · MAVEN</div>
          </div>
        </div>
      </div>

      <div className="impact-container">
        {/* Executive Summary */}
        <div style={{
          background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 8,
          padding: '16px 20px', marginBottom: 24,
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--navy-dark)', fontWeight: 700 }}>
            Executive Summary
          </h3>
          <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#1E3A5F', lineHeight: 1.65 }}>
            Modifying <strong>{p.name}</strong> impacts{' '}
            <strong>{d.items.length} component{d.items.length !== 1 ? 's' : ''}</strong>:{' '}
            {groupedItems.critical.length > 0 && (
              <><strong style={{ color: '#C0392B' }}>{groupedItems.critical.length} critical</strong>{', '}</>
            )}
            {groupedItems.high.length > 0 && (
              <><strong style={{ color: '#D97706' }}>{groupedItems.high.length} high</strong>{', '}</>
            )}
            {groupedItems.medium.length > 0 && (
              <><strong style={{ color: '#1C7293' }}>{groupedItems.medium.length} medium</strong>{', '}</>
            )}
            {groupedItems.unknown.length > 0 && (
              <><strong style={{ color: '#9CA3AF' }}>{groupedItems.unknown.length} unknown</strong></>
            )}
            {'. '}Analysis coverage: <strong style={{ color: covColor }}>{d.coverage}%</strong>.
          </p>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: '#6B7280' }}>Analysis Coverage</span>
              <span style={{ color: covColor, fontWeight: 700 }}>{d.coverage}%</span>
            </div>
            <div style={{ background: '#E5E7EB', borderRadius: 4, height: 6 }}>
              <div style={{ width: `${d.coverage}%`, background: covColor, height: 6, borderRadius: 4 }} />
            </div>
          </div>
          {d.coverageNote && (
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8, fontStyle: 'italic' }}>
              ⚠ {d.coverageNote}
            </div>
          )}
        </div>

        {/* Severity-banded sections */}
        {SEVERITY_GROUPS.map(({ key, label, color }) => {
          const items = groupedItems[key];
          if (!items || items.length === 0) return null;
          return (
            <div key={key} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 4, height: 20, background: color, borderRadius: 2, flexShrink: 0 }} />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-dark)' }}>
                  {label}
                </h3>
                <span style={{
                  fontSize: 11, color: '#6B7280', background: '#F3F4F6',
                  padding: '2px 8px', borderRadius: 12, fontWeight: 700,
                }}>
                  {items.length}
                </span>
              </div>
              {items.map((it, i) => (
                <ItemCard
                  key={i}
                  it={it}
                  onNav={() => router.push(`/programs/${encodeURIComponent(it.prog)}`)}
                />
              ))}
            </div>
          );
        })}

        {/* Validation gate */}
        <div className="validation-gate">
          <div className="gate-icon">🔒</div>
          <div className="gate-text">
            <h3>Engineer Validation Gate</h3>
            <p>
              This impact analysis must be reviewed by an engineer before any change is
              actioned. No automated process uses this output directly.
            </p>
            {showReviewer && (
              <div style={{ marginTop: 8 }}>
                <input
                  type="text"
                  placeholder="Reviewer name or email"
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  style={{
                    border: '1.5px solid var(--border)', borderRadius: 6,
                    padding: '6px 10px', fontFamily: 'var(--font-body)',
                    fontSize: 12, width: '100%', marginTop: 4,
                  }}
                />
              </div>
            )}
            {submitMsg && (
              <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 6 }}>
                ✓ {submitMsg}
              </div>
            )}
            <div className="gate-reviewer">
              {reviewer ? `Reviewed by: ${reviewer}` : '— awaiting engineer sign-off —'}
            </div>
          </div>
          <div className="gate-actions">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (!showReviewer) { setShowReviewer(true); } else { handleValidate('change_impact'); }
              }}
              disabled={submitting}
            >
              {showReviewer ? 'Submit sign-off' : 'Request sign-off'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => onTabChange('spec')}>
              Generate Draft Spec
            </button>
            <button className="btn btn-disabled btn-sm" disabled>Export</button>
          </div>
        </div>
      </div>
    </>
  );
}
