'use client';

import type { ProgramData } from '@/lib/parser/types';

interface Props {
  program: ProgramData;
}

function demoNote() {
  alert(
    'Prototype note: This action is illustrative — in the real MAVEN build, this triggers the engineer review and sign-off workflow.'
  );
}

export default function ModernizationSpec({ program: p }: Props) {
  const s = p.spec;

  return (
    <>
      <div className="flex items-center gap-12 mb-16">
        <div>
          <div className="panel-title">Modernization Spec — {p.name}</div>
          <div className="panel-subtitle" style={{ marginBottom: 0 }}>
            Java-target specification draft. Engineer sign-off required before use.
          </div>
        </div>
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <span className="badge badge-draft">
            <span className="badge-dot" />
            Draft — awaiting engineer validation
          </span>
        </div>
      </div>

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
    </>
  );
}
