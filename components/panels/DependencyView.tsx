'use client';

import { useRef, useEffect } from 'react';
import type { ProgramData, GraphNode, GraphEdge } from '@/lib/parser/types';

interface Props {
  program: ProgramData;
}

const EC: Record<string, string> = {
  call: '#065A82',
  data: '#1C7293',
  cics: '#E07B39',
  dyn: '#9CA3AF',
};

const NC: Record<string, { fill: string; stroke: string; tx: string; sub: string }> = {
  hero: { fill: '#1F3864', stroke: '#1C7293', tx: '#fff',    sub: 'rgba(255,255,255,.65)' },
  prog: { fill: '#fff',    stroke: '#065A82', tx: '#1F3864', sub: '#718096' },
  data: { fill: '#EBF5EE', stroke: '#1C7293', tx: '#1D6B37', sub: '#2E7D5E' },
  asm:  { fill: '#F9F0FF', stroke: '#9CA3AF', tx: '#5C3A9E', sub: '#7C6AAA' },
};

function ep(n: GraphNode, dir: string): [number, number] {
  const x = n.x ?? 0; const y = n.y ?? 0; const w = n.w ?? 100; const h = n.h ?? 50;
  switch (dir) {
    case 'top':    return [x + w / 2, y];
    case 'bottom': return [x + w / 2, y + h];
    case 'left':   return [x, y + h / 2];
    case 'right':  return [x + w, y + h / 2];
    case 'bl':     return [x + w * 0.3, y + h];
    case 'br':     return [x + w * 0.7, y + h];
    default:       return [x + w / 2, y + h / 2];
  }
}

function buildGraphSVG(g: ProgramData['graph']): string {
  const nm: Record<string, GraphNode> = {};
  g.nodes.forEach((n) => { nm[n.id] = n; });
  let maxX = 0; let maxY = 0;
  g.nodes.forEach((n) => {
    maxX = Math.max(maxX, (n.x ?? 0) + (n.w ?? 100) + 30);
    maxY = Math.max(maxY, (n.y ?? 0) + (n.h ?? 50) + 30);
  });

  const defs = `<defs>
    <marker id="a-call" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3z" fill="${EC.call}"/></marker>
    <marker id="a-data" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3z" fill="${EC.data}"/></marker>
    <marker id="a-cics" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3z" fill="${EC.cics}"/></marker>
    <marker id="a-dyn"  markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3z" fill="${EC.dyn}"/></marker>
    <filter id="ns"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-opacity="0.12"/></filter>
  </defs>`;

  let edges = '';
  g.edges.forEach((e) => {
    const fn = nm[e.from]; const tn = nm[e.to];
    if (!fn || !tn) return;
    const [x1, y1] = ep(fn, e.fd ?? 'bottom');
    const [x2, y2] = ep(tn, e.td ?? 'top');
    const col = EC[e.type] ?? '#999';
    const mk = `url(#a-${e.type})`;
    const da = e.type === 'cics' ? '6,4' : e.type === 'dyn' ? '5,4' : 'none';
    const dx = x2 - x1; const dy = y2 - y1;
    const pathD = `M${x1},${y1} C${x1 + dx * 0.1},${y1 + dy * 0.4} ${x2 - dx * 0.1},${y2 - dy * 0.4} ${x2},${y2}`;
    edges += `<path d="${pathD}" fill="none" stroke="${col}" stroke-width="1.8" stroke-dasharray="${da}" marker-end="${mk}" opacity=".8"/>`;
    const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2;
    const lbl = e.label && e.label.length > 24 ? e.label.slice(0, 22) + '…' : (e.label ?? '');
    const lw = lbl.length * 5.2 + 14;
    edges += `<rect x="${mx - lw / 2}" y="${my - 9}" width="${lw}" height="14" rx="3" fill="white" fill-opacity=".88" stroke="${col}" stroke-width=".5"/>
    <text x="${mx}" y="${my + 1}" text-anchor="middle" dominant-baseline="middle" font-family="Consolas,monospace" font-size="8" fill="${col}" font-weight="600">${lbl}</text>`;
  });

  let nodes = '';
  g.nodes.forEach((n) => {
    const C = NC[n.type] ?? NC.prog;
    const isHero = n.type === 'hero'; const isData = n.type === 'data'; const isAsm = n.type === 'asm';
    const da = isAsm ? '5,3' : 'none';
    const nx = n.x ?? 0; const ny = n.y ?? 0; const nw = n.w ?? 100; const nh = n.h ?? 50;
    nodes += `<g class="graph-node" data-id="${n.id}" data-sub="${n.sub}" data-type="${n.type}">`;
    if (isData) {
      const cx = nx + nw / 2; const ry = 9;
      nodes += `<rect x="${nx}" y="${ny + ry}" width="${nw}" height="${nh - ry}" fill="${C.fill}" stroke="${C.stroke}" stroke-width="1.5" rx="2"/>
      <ellipse cx="${cx}" cy="${ny + ry}" rx="${nw / 2}" ry="${ry}" fill="${C.fill}" stroke="${C.stroke}" stroke-width="1.5"/>`;
    } else {
      nodes += `<rect x="${nx}" y="${ny}" width="${nw}" height="${nh}" rx="${isHero ? 8 : 6}" fill="${C.fill}" stroke="${C.stroke}" stroke-width="${isHero ? 2.5 : 1.5}" stroke-dasharray="${da}" filter="url(#ns)"/>`;
      if (isHero) nodes += `<rect x="${nx}" y="${ny}" width="${nw}" height="${nh * 0.42}" rx="8" fill="rgba(28,114,147,.22)"/>`;
    }
    const tx = nx + nw / 2;
    const ty = isData ? ny + nh / 2 + 6 : ny + nh / 2 - 5;
    nodes += `<text x="${tx}" y="${ty}" text-anchor="middle" font-family="Consolas,monospace" font-size="${isHero ? 13 : 11.5}" font-weight="700" fill="${C.tx}">${n.label}</text>
    <text x="${tx}" y="${ty + 13}" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="8.5" fill="${C.sub}">${n.sub}</text>`;
    nodes += `</g>`;
  });

  return `<svg viewBox="0 0 ${maxX} ${maxY}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${maxX}" height="${maxY}" fill="#F8FAFD"/>
  ${defs}${edges}${nodes}
  </svg>`;
}

export default function DependencyView({ program: p }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const svgHtml = buildGraphSVG(p.graph);

  useEffect(() => {
    if (!wrapRef.current || !tooltipRef.current) return;
    const wrap = wrapRef.current;
    const tooltip = tooltipRef.current;
    const typeLabel: Record<string, string> = {
      hero: 'Hero program (this document)',
      prog: 'COBOL program',
      data: 'DB2 data store',
      asm:  'Assembler module (partial coverage)',
    };

    wrap.querySelectorAll<HTMLElement>('.graph-node').forEach((n) => {
      const lbl = typeLabel[n.dataset.type ?? ''] ?? n.dataset.type ?? '';
      n.addEventListener('mouseenter', () => {
        tooltip.innerHTML = `<strong>${n.dataset.id}</strong><br/>${n.dataset.sub}<br/><em style="opacity:.65;font-size:10px;">${lbl}</em>`;
        tooltip.style.display = 'block';
      });
      n.addEventListener('mousemove', (e) => {
        const r = wrap.getBoundingClientRect();
        tooltip.style.left = (e.clientX - r.left + 12) + 'px';
        tooltip.style.top  = (e.clientY - r.top  - 8)  + 'px';
      });
      n.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    });
  }, [svgHtml]);

  return (
    <>
      <div className="panel-title">Dependency View</div>
      <div className="panel-subtitle">
        Every call and data edge — structure determined by static analysis, not inferred.
      </div>

      <div className="dep-container">
        <div className="dep-header">
          <h2 dangerouslySetInnerHTML={{ __html: p.graph.title }} />
          <span className="badge badge-deterministic">
            <span className="badge-dot" />
            Structure: deterministic
          </span>
        </div>

        <div className="graph-svg-wrap" ref={wrapRef}>
          <div className="node-tooltip" ref={tooltipRef} />
          <div dangerouslySetInnerHTML={{ __html: svgHtml }} />
        </div>

        <div className="graph-legend">
          <div className="legend-item"><div className="legend-swatch swatch-hero" />Focus program</div>
          <div className="legend-item"><div className="legend-swatch swatch-prog" />COBOL program</div>
          <div className="legend-item"><div className="legend-swatch swatch-data" />DB2 / data store</div>
          <div className="legend-item"><div className="legend-swatch swatch-asm"  />Assembler (partial)</div>
          <div className="legend-item">
            <svg width="28" height="12" style={{ flexShrink: 0 }}>
              <line x1="0" y1="6" x2="28" y2="6" stroke="#065A82" strokeWidth="2" />
            </svg>
            CALL edge
          </div>
          <div className="legend-item">
            <svg width="28" height="12" style={{ flexShrink: 0 }}>
              <line x1="0" y1="6" x2="28" y2="6" stroke="#1C7293" strokeWidth="2" />
            </svg>
            Data edge
          </div>
          <div className="legend-item">
            <svg width="28" height="12" style={{ flexShrink: 0 }}>
              <line x1="0" y1="6" x2="28" y2="6" stroke="#E07B39" strokeWidth="2" strokeDasharray="5,3" />
            </svg>
            Runtime read
          </div>
          <div className="legend-item">
            <svg width="28" height="12" style={{ flexShrink: 0 }}>
              <line x1="0" y1="6" x2="28" y2="6" stroke="#9CA3AF" strokeWidth="2" strokeDasharray="4,3" />
            </svg>
            Dynamic call (partial)
          </div>
        </div>
      </div>

      <div className="honesty-note" style={{ maxWidth: 900 }}>
        <strong>Coverage note:</strong>{' '}
        {p.changeImpact.coverageNote}
      </div>
    </>
  );
}
