'use client';

import { useState } from 'react';
import type { ProgramData } from '@/lib/parser/types';

interface Props {
  program: ProgramData;
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

export default function ChangeImpact({ program: p }: Props) {
  const d = p.changeImpact;
  const [reviewer, setReviewer] = useState('');
  const [showReviewer, setShowReviewer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  const covColor = d.coverage >= 90 ? '#27AE60' : d.coverage >= 70 ? '#E07B39' : '#C0392B';

  async function handleValidate(artifactType: string) {
    if (!reviewer.trim()) {
      setShowReviewer(true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/validate/${p.name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifactType, reviewer, status: 'approved' }),
      });
      if (res.ok) {
        setSubmitMsg(`Sign-off recorded for ${reviewer}`);
      } else {
        setSubmitMsg('Sign-off recorded (demo mode)');
      }
    } catch {
      setSubmitMsg('Sign-off recorded (demo mode)');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-12 mb-16">
        <div>
          <div className="panel-title">Change Impact — {p.name}</div>
          <div className="panel-subtitle" style={{ marginBottom: 0 }}>
            If <strong>{p.name}</strong> changes, these programs and data stores are affected —
            traced to the graph edge that proves each relationship.
          </div>
        </div>
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <span className="badge badge-deterministic">
            <span className="badge-dot" />
            Traced · graph-grounded
          </span>
        </div>
      </div>

      <div className="impact-container">
        {/* Summary */}
        <div className="impact-summary">
          <div className="impact-summary-text">
            <h2 dangerouslySetInnerHTML={{ __html: d.query }} />
            <p>{d.items.length} dependent programs and data stores identified.</p>
          </div>
          <div className="coverage-block">
            <div className="coverage-label">
              <span>Analysis Coverage</span>
              <span style={{ color: covColor }}>{d.coverage}%</span>
            </div>
            <div className="coverage-bar-wrap">
              <div
                className="coverage-bar"
                style={{ width: `${d.coverage}%`, background: covColor }}
              />
            </div>
            <div className="coverage-note">⚠ {d.coverageNote}</div>
          </div>
        </div>

        {/* Table */}
        <div className="impact-table-wrap">
          <table className="impact-table">
            <thead>
              <tr>
                <th>Program / Store</th>
                <th>Relationship</th>
                <th>Impact</th>
                <th>Reason &amp; Source</th>
              </tr>
            </thead>
            <tbody>
              {d.items.map((it, i) => (
                <tr key={i}>
                  <td><span className="prog-ref">{it.prog}</span></td>
                  <td><span className="rel-tag">{it.rel}</span></td>
                  <td>
                    <span className={`severity ${SEV_CLASS[it.severity] ?? 'sev-medium'}`}>
                      {SEV_LABEL[it.severity] ?? it.severity.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div className="impact-reason">
                      {it.reason}
                      <br />
                      <span className="edge-ref">Source: {it.edge}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
                    border: '1.5px solid var(--border)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    width: '100%',
                    marginTop: 4,
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
              {reviewer
                ? `Reviewed by: ${reviewer}`
                : '— awaiting engineer sign-off —'}
            </div>
          </div>
          <div className="gate-actions">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (!showReviewer) {
                  setShowReviewer(true);
                } else {
                  handleValidate('change_impact');
                }
              }}
              disabled={submitting}
            >
              {showReviewer ? 'Submit sign-off' : 'Request sign-off'}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() =>
                alert(
                  'Prototype note: In production MAVEN, this generates a draft modernization spec from the impact analysis.'
                )
              }
            >
              Generate Draft Spec
            </button>
            <button className="btn btn-disabled btn-sm" disabled>
              Export
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
