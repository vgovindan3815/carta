'use client';

import { useState, useEffect, useRef } from 'react';
import type { ProgramData } from '@/lib/parser/types';

interface Props {
  program: ProgramData;
}

export default function BusinessRules({ program: p }: Props) {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const [selectedCitation, setSelectedCitation] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState<string | null>(null);
  const [sourceFetching, setSourceFetching] = useState(true);
  const [highlightLines, setHighlightLines] = useState<Set<number>>(new Set());
  const sourceRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    window.print();
  }

  const sections = p.businessRules ?? [];

  // Fetch source on mount
  useEffect(() => {
    setSourceFetching(true);
    fetch(`/api/programs/${encodeURIComponent(p.name)}/source`)
      .then((res) => res.json())
      .then((data: { sourceText: string | null }) => {
        setSourceText(data.sourceText ?? null);
      })
      .catch(() => setSourceText(null))
      .finally(() => setSourceFetching(false));
  }, [p.name]);

  // When a citation is selected, find matching lines in source
  useEffect(() => {
    if (!selectedCitation || !sourceText) {
      setHighlightLines(new Set());
      return;
    }
    // Extract first all-caps COBOL word from the citation label
    const cobolWord = selectedCitation.match(/\b([A-Z][A-Z0-9-]{2,})\b/)?.[1] ?? selectedCitation.slice(0, 20).toUpperCase();
    const lines = sourceText.split('\n');
    const matched = new Set<number>();
    const upper = cobolWord.toUpperCase();
    let firstMatch = -1;
    lines.forEach((line, idx) => {
      if (line.toUpperCase().includes(upper)) {
        matched.add(idx);
        if (firstMatch === -1) firstMatch = idx;
      }
    });
    // Also highlight ±15 lines around first match for context
    if (firstMatch !== -1) {
      const start = Math.max(0, firstMatch - 5);
      const end = Math.min(lines.length - 1, firstMatch + 24);
      for (let i = start; i <= end; i++) matched.add(i);
    }
    setHighlightLines(matched);

    // Scroll to first highlighted line
    if (firstMatch !== -1 && sourceRef.current) {
      const el = sourceRef.current.querySelector<HTMLDivElement>(`[data-line="${firstMatch}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedCitation, sourceText]);

  const sourceLines = sourceText ? sourceText.split('\n') : [];

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

      {/* Split layout: BRD (left 60%) + Source viewer (right 40%) */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* ── Left panel: BRD sections ── */}
        <div style={{ flex: '0 0 60%', minWidth: 0 }}>
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
                              <button
                                key={ci}
                                title={c.edge}
                                onClick={() => setSelectedCitation(
                                  selectedCitation === c.label ? null : c.label
                                )}
                                style={{
                                  cursor: 'pointer',
                                  background: selectedCitation === c.label ? '#1F3864' : undefined,
                                  color: selectedCitation === c.label ? '#fff' : undefined,
                                  border: selectedCitation === c.label ? '1.5px solid #1F3864' : undefined,
                                  fontFamily: 'var(--font-body)',
                                  fontSize: 'inherit',
                                }}
                                className="source-citation"
                              >
                                [{ci + 1}] {c.label}
                              </button>
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
        </div>

        {/* ── Right panel: Source code viewer ── */}
        <div style={{
          flex: '0 0 40%', minWidth: 0,
          position: 'sticky', top: 16,
          maxHeight: 'calc(100vh - 120px)',
          display: 'flex', flexDirection: 'column',
          border: '1.5px solid #E5E7EB', borderRadius: 8,
          overflow: 'hidden', background: '#1E1E2E',
        }}>
          {/* Source panel header */}
          <div style={{
            padding: '10px 14px',
            background: '#2D2D3F',
            borderBottom: '1px solid #3D3D5C',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#A0A0C0', fontFamily: 'Consolas, monospace' }}>
              {p.name}.cbl
            </div>
            {selectedCitation && (
              <div style={{ fontSize: 10, color: '#E07B39', fontFamily: 'Consolas, monospace' }}>
                Searching: {selectedCitation.slice(0, 30)}
              </div>
            )}
            {!selectedCitation && !sourceFetching && sourceText && (
              <div style={{ fontSize: 10, color: '#6B7280' }}>
                Click a citation chip to highlight
              </div>
            )}
          </div>

          {/* Source content */}
          <div ref={sourceRef} style={{ flex: 1, overflow: 'auto' }}>
            {sourceFetching && (
              <div style={{ padding: 24, color: '#6B7280', fontSize: 12, textAlign: 'center' }}>
                Loading source…
              </div>
            )}
            {!sourceFetching && !sourceText && (
              <div style={{ padding: 24, color: '#6B7280', fontSize: 12, lineHeight: 1.6 }}>
                {p.pipelineStatus?.github !== 'success'
                  ? <>Source code not found in the connected GitHub repository.<br/>Run <strong>↺ Refresh Analysis</strong> to attempt a fresh fetch, or verify the repository contains <strong>{p.name}.cbl</strong>.</>
                  : <>Source code not stored. Run <strong>↺ Refresh Analysis</strong> to capture the source.</>
                }
              </div>
            )}
            {!sourceFetching && sourceText && (
              <pre style={{
                margin: 0, padding: 0,
                fontSize: 11, lineHeight: 1.55,
                fontFamily: 'Consolas, "Courier New", monospace',
                color: '#CDD6F4',
              }}>
                {sourceLines.map((line, idx) => {
                  const isHighlighted = highlightLines.has(idx);
                  return (
                    <div
                      key={idx}
                      data-line={idx}
                      style={{
                        display: 'flex',
                        background: isHighlighted ? 'rgba(224, 123, 57, 0.25)' : 'transparent',
                        borderLeft: isHighlighted ? '3px solid #E07B39' : '3px solid transparent',
                        transition: 'background 0.15s',
                      }}
                    >
                      <span style={{
                        userSelect: 'none', flexShrink: 0,
                        width: 44, textAlign: 'right', paddingRight: 12,
                        color: isHighlighted ? '#E07B39' : '#4A4A6A',
                        fontSize: 10,
                      }}>
                        {idx + 1}
                      </span>
                      <span style={{ paddingLeft: 4, paddingRight: 8, whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {line}
                      </span>
                    </div>
                  );
                })}
              </pre>
            )}
          </div>
        </div>
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
        button.source-citation {
          display: inline-flex; align-items: center;
          padding: 2px 8px; border-radius: 4px;
          font-size: 11px; font-weight: 600;
          background: #F0F4FF; color: #1F3864;
          border: 1.5px solid #C7D2FE;
        }
        button.source-citation:hover {
          background: #E0E7FF;
        }
      `}</style>
    </>
  );
}
