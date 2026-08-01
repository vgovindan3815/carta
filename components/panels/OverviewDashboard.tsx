'use client';

import type { ProgramData, GraphNode, GraphEdge } from '@/lib/parser/types';

type TabId = 'overview' | 'dependency' | 'business' | 'impact' | 'spec';

interface Props {
  program: ProgramData;
  onTabChange: (tab: TabId) => void;
}

const EC: Record<string, string> = {
  call: '#065A82',
  data: '#1C7293',
  cics: '#E07B39',
  dyn: '#9CA3AF',
};

const NC: Record<string, { fill: string; stroke: string; sw: number; da: string; tc: string; sc: string }> = {
  hero: { fill: '#1F3864', stroke: '#1C7293', sw: 3,   da: 'none', tc: '#FFFFFF',              sc: 'rgba(255,255,255,.6)' },
  prog: { fill: '#EBF4FF', stroke: '#065A82', sw: 1.8, da: 'none', tc: '#1F3864',              sc: '#4A6080' },
  data: { fill: '#E8F5EE', stroke: '#1C7293', sw: 1.8, da: 'none', tc: '#1D5E30',              sc: '#2E7D5E' },
  asm:  { fill: '#F0E8FF', stroke: '#9CA3AF', sw: 1.8, da: '4,3',  tc: '#4B2D80',              sc: '#7C6AAA' },
};

function buildCircularSVG(cl: ProgramData['cLayout']): string {
  const nm: Record<string, typeof cl.nodes[0]> = {};
  cl.nodes.forEach((n) => { nm[n.id] = n; });

  const defs = `<defs>
    <marker id="oc-call" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3z" fill="${EC.call}"/></marker>
    <marker id="oc-data" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3z" fill="${EC.data}"/></marker>
    <marker id="oc-cics" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3z" fill="${EC.cics}"/></marker>
    <marker id="oc-dyn"  markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3z" fill="${EC.dyn}"/></marker>
    <filter id="oc-sh"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.14"/></filter>
  </defs>`;

  let edges = '';
  cl.edges.forEach((e) => {
    const fn = nm[e.from]; const tn = nm[e.to];
    if (!fn || !tn || !fn.cx || !fn.cy || !tn.cx || !tn.cy) return;
    const dx = tn.cx - fn.cx; const dy = tn.cy - fn.cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const x1 = fn.cx + ((fn.r ?? 30) + 1) * dx / dist;
    const y1 = fn.cy + ((fn.r ?? 30) + 1) * dy / dist;
    const x2 = tn.cx - ((tn.r ?? 30) + 6) * dx / dist;
    const y2 = tn.cy - ((tn.r ?? 30) + 6) * dy / dist;
    const col = EC[e.type] ?? '#999';
    const da = e.type === 'dyn' ? '5,3' : e.type === 'cics' ? '6,3' : 'none';
    edges += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="1.8" stroke-dasharray="${da}" marker-end="url(#oc-${e.type})" opacity=".85"/>`;
  });

  let nodes = '';
  cl.nodes.forEach((n) => {
    const C = NC[n.type] ?? NC.prog;
    const cx = n.cx ?? 0; const cy = n.cy ?? 0; const r = n.r ?? 30;
    nodes += `<g>`;
    nodes += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.fill}" stroke="${C.stroke}" stroke-width="${C.sw}" stroke-dasharray="${C.da}" filter="url(#oc-sh)"/>`;
    if (n.type === 'hero') {
      nodes += `<circle cx="${cx}" cy="${cy}" r="${r - 6}" fill="none" stroke="rgba(28,114,147,.35)" stroke-width="1.5"/>`;
    }
    const fs = n.type === 'hero' ? 11 : 9;
    nodes += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" dominant-baseline="middle" font-family="Consolas,monospace" font-size="${fs}" font-weight="800" fill="${C.tc}">${n.label}</text>`;
    nodes += `<text x="${cx}" y="${cy + 8}" text-anchor="middle" dominant-baseline="middle" font-family="Segoe UI,Arial,sans-serif" font-size="7" fill="${C.sc}">${n.sub}</text>`;
    nodes += `</g>`;
  });

  return `<svg viewBox="0 0 ${cl.w} ${cl.h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${cl.w}" height="${cl.h}" rx="8" fill="#F4F8FC"/>
  ${defs}${edges}${nodes}
  </svg>`;
}

function pillClass(prog: string): string {
  if (prog === 'GTMASM01') return 'asm-pill';
  if (prog === 'GTMCICS4') return 'cics-pill';
  return '';
}

function langLabel(prog: string): string {
  if (prog === 'GTMASM01') return 'ASM ?';
  if (prog === 'GTMCICS4') return 'CICS';
  if (prog === 'GTMDB2IO') return 'DB2';
  return 'COBOL';
}

const STEP_LABELS: Record<string, string> = {
  success: '✓',
  fail: '✗',
  skip: '—',
  pending: '…',
};
const STEP_COLORS: Record<string, string> = {
  success: '#27AE60',
  fail: '#C0392B',
  skip: '#9CA3AF',
  pending: '#E07B39',
};

function PipelineFlow({ ps }: { ps: NonNullable<ProgramData['pipelineStatus']> }) {
  const steps = [
    { key: 'cast' as const, label: 'CAST Reports', status: ps.cast },
    { key: 'github' as const, label: 'GitHub Source', status: ps.github },
    { key: 'llm' as const, label: 'LLM Analysis', status: ps.llm },
    { key: 'docs' as const, label: 'Docs Generated', status: ps.docs },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 14, flexWrap: 'wrap', rowGap: 6 }}>
      {steps.map((s, i) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px',
            borderRadius: 20, border: `1.5px solid ${STEP_COLORS[s.status]}`,
            background: s.status === 'success' ? '#EFF9F3' : s.status === 'fail' ? '#FEF2F2' : s.status === 'pending' ? '#FFF8EC' : '#F3F4F6',
            fontSize: 11, fontWeight: 600,
          }}>
            <span style={{ color: STEP_COLORS[s.status], fontSize: 12, fontWeight: 800 }}>
              {STEP_LABELS[s.status]}
            </span>
            <span style={{ color: '#374151' }}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 18, borderTop: '1.5px dashed #CBD5E1', margin: '0 2px' }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function OverviewDashboard({ program: p, onTabChange }: Props) {
  const d = p.changeImpact;
  const items = d.items;
  const SHOW = 5;

  const covColor = d.coverage >= 90 ? '#27AE60' : d.coverage >= 70 ? '#E07B39' : '#C0392B';
  const hasWarn = d.coverage < 100;
  const svgHtml = p.cLayout ? buildCircularSVG(p.cLayout) : '';
  const ps = p.pipelineStatus;
  const noCast = ps?.cast !== 'success';

  // Domain short form
  const domainShort = p.domain.includes('/') ? p.domain.split('/')[1]?.trim() : p.domain;

  return (
    <div>
      {ps && <PipelineFlow ps={ps} />}
      {noCast && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 14px',
          background: '#FFF8EC', border: '1px solid #F59E0B', borderRadius: 8, marginBottom: 12,
          fontSize: 12, color: '#92400E',
        }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          <span>
            <strong>No CAST dependency reports available.</strong> The dependency graph was generated
            by LLM analysis of the COBOL source. Edge confidence may be lower than a deterministic
            static analysis tool would produce — verify critical paths manually.
          </span>
        </div>
      )}
    <div className="ov-dashboard">
      {/* LEFT PANEL */}
      <div className="ov-left">
        <div className="ov-section-lbl">Program in Focus</div>
        <div className="ov-focus-card">
          <div className="ov-focus-name">{p.name}</div>
          <div className="ov-focus-meta">
            {p.language} · {domainShort} · {p.loc.toLocaleString()} LOC
          </div>
        </div>

        <div className="ov-section-lbl">Affected Programs ({items.length})</div>
        <div className="ov-affected-list">
          {items.slice(0, SHOW).map((it) => (
            <div
              key={it.prog}
              className="ov-aff-row"
              onClick={() => onTabChange('impact')}
            >
              <span className="ov-aff-name">{it.prog}</span>
              <span className={`ov-aff-pill ${pillClass(it.prog)}`}>{langLabel(it.prog)}</span>
            </div>
          ))}
          {items.length > SHOW && (
            <div className="ov-more-link" onClick={() => onTabChange('impact')}>
              + {items.length - SHOW} more…
            </div>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="ov-section-lbl">Documentation</div>
          {(
            [
              { tab: 'dependency' as TabId, icon: '🔗', label: 'Dependency View', sub: 'Deterministic' },
              { tab: 'business'  as TabId, icon: '📋', label: 'Business Rules',  sub: 'LLM · grounded' },
              { tab: 'impact'    as TabId, icon: '💥', label: 'Change Impact',   sub: 'Traced' },
              { tab: 'spec'      as TabId, icon: '🏗️', label: 'Mod. Spec',      sub: 'Draft' },
            ] as const
          ).map((t) => (
            <div key={t.tab} className="ov-aff-row" onClick={() => onTabChange(t.tab)}>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {t.icon} {t.label}
              </span>
              <span className="ov-aff-pill">{t.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CENTER PANEL — circular graph */}
      <div className="ov-center">
        <div className="ov-center-top">
          <span className="ov-center-lbl">Dependency Graph — Call &amp; Data Edges</span>
          <span className={`badge ${noCast ? 'badge-llm' : 'badge-deterministic'}`} style={{ fontSize: 10 }}>
            <span className="badge-dot" />
            {noCast ? 'LLM-generated · no CAST reports' : 'Structure: deterministic (CAST)'}
          </span>
        </div>
        <div
          className="ov-graph-area"
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
        <div className="ov-center-legend">
          <div className="ov-leg-item">
            <div className="ov-leg-dot" style={{ background: '#1F3864', border: '2px solid #1C7293' }} />
            In focus
          </div>
          <div className="ov-leg-item">
            <div className="ov-leg-dot" style={{ background: '#EBF4FF', border: '2px solid #065A82' }} />
            Direct dependency
          </div>
          <div className="ov-leg-item">
            <div className="ov-leg-dot" style={{ background: '#E8F5EE', border: '2px solid #1C7293' }} />
            Data store
          </div>
          <div className="ov-leg-item">
            <div className="ov-leg-dot" style={{ background: '#F0E8FF', border: '2px dashed #9CA3AF' }} />
            Partial (Assembler)
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="ov-right">
        <div className="ov-ask-lbl">Ask in Business Terms</div>
        <div className="ov-ask-box">
          {p.overviewQuery ?? d.query.replace(/<[^>]+>/g, '')}
        </div>
        <div className="ov-expl-badge">
          <span className="ov-expl-dot" />
          Explanation: BNY LLM, grounded in graph
        </div>

        {hasWarn && (
          <div className="ov-cov-warn">
            <span>⚠</span>
            <div>
              {items.filter((i) => i.severity === 'unknown').length} Assembler dependency
              partially analysed — <strong>Coverage {d.coverage}%</strong> — verify manually.
            </div>
          </div>
        )}

        <div
          className="ov-narrative"
          dangerouslySetInnerHTML={{ __html: p.overviewNarrative ?? '' }}
        />

        <div className="ov-edge-list">
          {(p.overviewEdges ?? []).map((e, i) => (
            <div key={i} className="ov-edge-row">
              <div className="ov-edge-num">{i + 1}</div>
              <div className="ov-edge-txt">{e}</div>
            </div>
          ))}
        </div>

        <div className="ov-gate">
          <div className="ov-gate-hdr">◇ Validation Gate — Required Before Any Action</div>
          <div className="ov-gate-body">
            MAVEN drafts. An engineer verifies against the graph before a spec or code change
            proceeds. Nothing here is auto-applied.
          </div>
          <div className="ov-gate-rev">Reviewed by: — awaiting engineer sign-off —</div>
          <button
            className="ov-gate-btn1"
            onClick={() => onTabChange('spec')}
          >
            Generate draft spec for this change
          </button>
          <button
            className="ov-gate-btn2"
            onClick={() =>
              alert(
                'Prototype note: This action is illustrative — in the real MAVEN build, this triggers the engineer review and sign-off workflow.'
              )
            }
          >
            Export impact report
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}
