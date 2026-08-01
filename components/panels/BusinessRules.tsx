'use client';

import type { ProgramData } from '@/lib/parser/types';

interface Props {
  program: ProgramData;
}

export default function BusinessRules({ program: p }: Props) {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  function handlePrint() {
    window.print();
  }

  const sections = p.businessRules ?? [];

  return (
    <>
      {/* BRD Document Header */}
      <div style={{ borderBottom: '2px solid var(--navy-dark)', paddingBottom: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
              Business Requirements Document
            </div>
            <div className="panel-title" style={{ marginBottom: 4 }}>
              BRD — {p.name}
            </div>
            <div className="panel-subtitle" style={{ marginBottom: 0 }}>
              Plain-language business requirements derived from COBOL source. Each requirement cites its source dependency edge.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <span className="badge badge-llm">
              <span className="badge-dot" />
              LLM · grounded in deterministic graph
            </span>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Generated: {today}</div>
            <button
              onClick={handlePrint}
              style={{
                fontSize: 11, padding: '4px 12px', borderRadius: 4,
                border: '1px solid var(--border)', background: 'white',
                cursor: 'pointer', color: 'var(--text-2)', fontFamily: 'var(--font-body)',
              }}
            >
              ⎙ Print / Export
            </button>
          </div>
        </div>
      </div>

      {/* Table of Contents */}
      {sections.length > 0 && (
        <div style={{ background: '#F8FAFD', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px', marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy-dark)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Table of Contents
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {sections.map((sec, si) => (
              <li key={si} style={{ fontSize: 12 }}>
                <a
                  href={`#brd-section-${si}`}
                  style={{ color: 'var(--navy-dark)', textDecoration: 'none', fontWeight: 600 }}
                  onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                >
                  Section {si + 1}: {sec.section}
                </a>
                <span style={{ color: 'var(--text-3)', marginLeft: 8, fontSize: 11 }}>
                  ({sec.rules?.length ?? 0} requirement{(sec.rules?.length ?? 0) !== 1 ? 's' : ''})
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="biz-container">
        {sections.map((sec, si) => {
          const abbrev = sec.section
            .split(/\s+/)
            .filter((w) => /^[A-Za-z]/.test(w))
            .map((w) => w[0].toUpperCase())
            .join('')
            .slice(0, 3)
            .padEnd(3, 'X');

          return (
            <div key={si} id={`brd-section-${si}`} className="biz-section">
              <div className="biz-section-title">
                <span
                  style={{
                    width: 22, height: 22,
                    background: 'var(--navy-dark)', color: '#fff',
                    borderRadius: '50%',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}
                >
                  {si + 1}
                </span>
                Section {si + 1}: {sec.section}
              </div>

              {sec.rules.map((rule, ri) => {
                const reqId = `BR-${abbrev}-${String(ri + 1).padStart(3, '0')}`;
                return (
                  <div key={ri} className="biz-rule">
                    <div style={{
                      fontSize: 10, fontWeight: 800, color: 'var(--navy-dark)',
                      fontFamily: 'Consolas, monospace', marginBottom: 6,
                      background: '#EEF2FF', display: 'inline-block',
                      padding: '2px 8px', borderRadius: 4,
                    }}>
                      {reqId}
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: rule.text }} />
                    {(rule.citations ?? []).length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(rule.citations ?? []).map((c, ci) => (
                          <span key={ci} className="source-citation" title={c.edge}>
                            [{ci + 1}] {c.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <style>{`
        @media print {
          .biz-container { page-break-inside: auto; }
          .biz-section { page-break-inside: avoid; }
          .badge, button { display: none !important; }
        }
        .brd-statement { margin: 6px 0 4px 0; }
        .brd-rationale { margin: 4px 0; color: #374151; }
        .brd-source { margin: 4px 0 0 0; color: #6B7280; font-size: 11px; }
      `}</style>
    </>
  );
}
