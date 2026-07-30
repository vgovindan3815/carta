'use client';

import type { ProgramData } from '@/lib/parser/types';

interface Props {
  program: ProgramData;
}

export default function BusinessRules({ program: p }: Props) {
  return (
    <>
      <div className="flex items-center gap-12 mb-16">
        <div>
          <div className="panel-title">Business Rules — {p.name}</div>
          <div className="panel-subtitle" style={{ marginBottom: 0 }}>
            Plain-language explanation. Each claim cites its source dependency edge.
          </div>
        </div>
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <span className="badge badge-llm">
            <span className="badge-dot" />
            LLM · grounded in deterministic graph
          </span>
        </div>
      </div>

      <div className="biz-container">
        {(p.businessRules ?? []).map((sec, si) => (
          <div key={si} className="biz-section">
            <div className="biz-section-title">
              <span
                style={{
                  width: 22,
                  height: 22,
                  background: 'var(--navy-dark)',
                  color: '#fff',
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {si + 1}
              </span>
              {sec.section}
            </div>

            {sec.rules.map((rule, ri) => (
              <div key={ri} className="biz-rule">
                <span dangerouslySetInnerHTML={{ __html: rule.text }} />
                {(rule.citations ?? []).map((c, ci) => (
                  <span key={ci} className="source-citation" title={c.edge}>
                    {c.label}
                  </span>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
