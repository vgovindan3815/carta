'use client';

import { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProgramData, GraphNode, GraphEdge } from '@/lib/parser/types';

interface Props {
  program: ProgramData;
}

// IBM system utility descriptions — shown in tooltip on hover
const SYSTEM_PROGRAMS = new Map<string, string>([
  ['IEFBR14', 'IBM no-op utility — JCL placeholder step used to allocate or delete datasets without running any program logic.'],
  ['IDCAMS', 'IBM Access Method Services — manages VSAM datasets (DEFINE, DELETE, REPRO, LISTCAT).'],
  ['SORT', 'Syncsort / DFSORT — high-performance sequential dataset sorting utility.'],
  ['DFSORT', 'IBM DFSORT — sorts, merges, and copies sequential datasets.'],
  ['IEBGENER', 'IBM utility — copies sequential datasets or converts SYSIN data to SYSOUT.'],
  ['IEBCOPY', 'IBM utility — copies partitioned datasets (PDS/PDSE) and can select/exclude members.'],
  ['IEBUPDTE', 'IBM utility — updates partitioned dataset members with sequential change records.'],
  ['IEHPROGM', 'IBM utility — scratch/rename/catalogue operations on datasets.'],
  ['IKJEFT01', 'IBM TSO Terminal Monitor (batch) — runs CLIST, REXX, or DB2 commands via SYSTSIN. The actual COBOL/DB2 program is named in a RUN PROGRAM(...) statement in SYSTSIN.'],
  ['DSNUTILB', 'IBM DB2 Utility — runs DB2 batch utilities (RUNSTATS, REORG, LOAD, UNLOAD, COPY).'],
  ['DSNTIAD', 'IBM DB2 dynamic SQL — executes SQL statements from SYSIN interactively.'],
  ['DSNUPROC', 'IBM DB2 utility procedure — wrapper proc for DB2 utility jobs.'],
  ['ICETOOL', 'Syncsort ICETOOL — extended sort/copy/statistics utility with multiple operations per job.'],
  ['IEBPTPCH', 'IBM utility — prints or punches sequential or partitioned dataset records.'],
  ['IEHLIST', 'IBM utility — lists VTOC entries and PDS directories.'],
  ['IFASMFDP', 'IBM SMF Data Printer — prints or dumps SMF (System Management Facility) records.'],
]);

// Edge type → colour
const EC: Record<string, string> = {
  call:  '#1F3864',
  data:  '#1C7293',
  cics:  '#E07B39',
  dyn:   '#9CA3AF',
  jcl:   '#7C3AED',
  proc:  '#0891B2',
  copy:  '#059669',
};

// Node type → colours
const NC: Record<string, { fill: string; stroke: string; tx: string; sub: string }> = {
  hero: { fill: '#1F3864', stroke: '#1C7293',  tx: '#fff',    sub: 'rgba(255,255,255,.7)' },
  prog: { fill: '#fff',    stroke: '#1F3864',  tx: '#1F3864', sub: '#6B7280' },
  data: { fill: '#EBF5EE', stroke: '#059669',  tx: '#065F46', sub: '#34A678' },
  asm:  { fill: '#F5F3FF', stroke: '#7C3AED',  tx: '#5B21B6', sub: '#7C3AED' },
  jcl:  { fill: '#FFF7ED', stroke: '#E07B39',  tx: '#92400E', sub: '#D97706' },
  proc: { fill: '#E0F2FE', stroke: '#0891B2',  tx: '#0C4A6E', sub: '#0891B2' },
  cpy:  { fill: '#F0FDF4', stroke: '#059669',  tx: '#065F46', sub: '#059669' },
  sys:  { fill: '#F9FAFB', stroke: '#9CA3AF',  tx: '#6B7280', sub: '#9CA3AF' },
};

const EDGE_LABELS: Record<string, string> = {
  call: 'CALL', data: 'DATA', cics: 'CICS', dyn: 'DYN CALL',
  jcl: 'JCL', proc: 'PROC', copy: 'COPY',
};

const NODE_TYPE_LABELS: Record<string, string> = {
  hero: 'Hero program (this document)',
  prog: 'COBOL program',
  data: 'DB2 / dataset',
  asm:  'Assembler module',
  jcl:  'JCL job',
  proc: 'JCL procedure',
  cpy:  'Copybook',
  sys:  'IBM system utility',
};

/** Compute the point on the circle boundary toward (tx, ty). */
function circleEdgePoint(cx: number, cy: number, r: number, tx: number, ty: number): [number, number] {
  const dx = tx - cx; const dy = ty - cy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  return [cx + (dx / dist) * r, cy + (dy / dist) * r];
}

function buildCircularSVG(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
): string {
  const nm: Record<string, GraphNode> = {};
  nodes.forEach((n) => { nm[n.id] = n; });

  const defs = `<defs>
    ${Object.entries(EC).map(([t, col]) =>
      `<marker id="arr-${t}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3z" fill="${col}" opacity="0.85"/>
      </marker>`
    ).join('')}
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.13"/>
    </filter>
    <filter id="shadowHero" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="5" flood-opacity="0.22"/>
    </filter>
  </defs>`;

  // Draw edges first (under nodes)
  let edgeSvg = '';
  edges.forEach((e) => {
    const fn = nm[e.from]; const tn = nm[e.to];
    if (!fn || !tn) return;
    const fcx = fn.cx ?? 0; const fcy = fn.cy ?? 0; const fr = fn.r ?? 36;
    const tcx = tn.cx ?? 0; const tcy = tn.cy ?? 0; const tr = tn.r ?? 36;
    const [x1, y1] = circleEdgePoint(fcx, fcy, fr, tcx, tcy);
    const [x2, y2] = circleEdgePoint(tcx, tcy, tr, fcx, fcy);
    const col = EC[e.type] ?? '#9CA3AF';
    const da = e.type === 'dyn' || e.type === 'cics' ? '6,4' : 'none';
    const opacity = e.type === 'dyn' ? '0.55' : '0.75';
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1; const dy = y2 - y1;
    const perp = Math.sqrt(dx * dx + dy * dy) * 0.18;
    const nx = -dy / (Math.sqrt(dx * dx + dy * dy) || 1);
    const ny =  dx / (Math.sqrt(dx * dx + dy * dy) || 1);
    const cx1 = mx + nx * perp; const cy1 = my + ny * perp;
    const pathD = `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx1.toFixed(1)},${cy1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
    edgeSvg += `<path d="${pathD}" fill="none" stroke="${col}" stroke-width="1.8"
      stroke-dasharray="${da}" marker-end="url(#arr-${e.type})" opacity="${opacity}"/>`;

    // Edge label at midpoint of the quadratic curve (t=0.5)
    const lx = 0.25 * x1 + 0.5 * cx1 + 0.25 * x2;
    const ly = 0.25 * y1 + 0.5 * cy1 + 0.25 * y2;
    const rawLabel = e.label ?? EDGE_LABELS[e.type] ?? e.type;
    const lbl = rawLabel.length > 18 ? rawLabel.slice(0, 16) + '…' : rawLabel;
    const lw = lbl.length * 5 + 12;
    if (lbl) {
      edgeSvg += `<rect x="${(lx - lw / 2).toFixed(1)}" y="${(ly - 8).toFixed(1)}" width="${lw}" height="13"
        rx="3" fill="white" fill-opacity="0.9" stroke="${col}" stroke-width="0.5"/>
      <text x="${lx.toFixed(1)}" y="${(ly + 1).toFixed(1)}" text-anchor="middle"
        dominant-baseline="middle" font-family="Consolas,monospace" font-size="7.5"
        fill="${col}" font-weight="700">${lbl}</text>`;
    }
  });

  // Draw nodes on top
  let nodeSvg = '';
  nodes.forEach((n) => {
    const C = NC[n.type] ?? NC.prog;
    const cx = n.cx ?? 0; const cy = n.cy ?? 0; const r = n.r ?? 36;
    const isHero = n.type === 'hero';
    const filter = isHero ? 'filter="url(#shadowHero)"' : 'filter="url(#shadow)"';

    nodeSvg += `<g class="graph-node" data-id="${n.id}" data-sub="${n.sub ?? ''}" data-type="${n.type}" style="cursor:pointer">`;

    if (n.type === 'data' || n.type === 'cpy') {
      // Cylinder / drum shape
      const ry = r * 0.28;
      nodeSvg += `<ellipse cx="${cx}" cy="${cy - r + ry}" rx="${r}" ry="${ry}"
        fill="${C.stroke}" opacity="0.25"/>
      <rect x="${cx - r}" y="${cy - r + ry}" width="${r * 2}" height="${(r - ry) * 2}"
        fill="${C.fill}" stroke="${C.stroke}" stroke-width="1.5"/>
      <ellipse cx="${cx}" cy="${cy + r - ry}" rx="${r}" ry="${ry}"
        fill="${C.fill}" stroke="${C.stroke}" stroke-width="1.5"/>
      <ellipse cx="${cx}" cy="${cy - r + ry}" rx="${r}" ry="${ry}"
        fill="${C.fill}" stroke="${C.stroke}" stroke-width="1.5"/>`;
    } else if (n.type === 'sys') {
      // Hexagon shape for system utilities
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
      }).join(' ');
      nodeSvg += `<polygon points="${pts}" fill="${C.fill}" stroke="${C.stroke}" stroke-width="1.8" stroke-dasharray="4,2" ${filter}/>`;
    } else {
      // Circle node
      const strokeW = isHero ? 3 : 1.8;
      const dash = n.type === 'asm' ? 'stroke-dasharray="6,3"' : '';
      nodeSvg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.fill}"
        stroke="${C.stroke}" stroke-width="${strokeW}" ${dash} ${filter}/>`;
      if (isHero) {
        nodeSvg += `<circle cx="${cx}" cy="${cy}" r="${r * 0.72}" fill="none"
          stroke="rgba(28,114,147,0.35)" stroke-width="1.5"/>`;
      }
    }

    // Label — two lines: name + sub
    const labelY = (n.type === 'data' || n.type === 'cpy') ? cy + 3 : cy - 4;
    const subY = labelY + 13;
    const fontSize = isHero ? 12 : (n.id.length > 8 ? 9 : 10.5);
    nodeSvg += `<text x="${cx}" y="${labelY}" text-anchor="middle" dominant-baseline="middle"
      font-family="Consolas,monospace" font-size="${fontSize}" font-weight="800"
      fill="${C.tx}">${n.label}</text>`;
    if (n.sub && n.sub !== n.label) {
      const subText = n.sub.length > 12 ? n.sub.slice(0, 10) + '…' : n.sub;
      nodeSvg += `<text x="${cx}" y="${subY}" text-anchor="middle" dominant-baseline="middle"
        font-family="Segoe UI,Arial,sans-serif" font-size="7.5" fill="${C.sub}">${subText}</text>`;
    }

    nodeSvg += '</g>';
  });

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;height:100%;display:block">
    <rect width="${width}" height="${height}" fill="#F8FAFD" rx="8"/>
    ${defs}${edgeSvg}${nodeSvg}
  </svg>`;
}

export default function DependencyView({ program: p }: Props) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const cNodes = p.cLayout?.nodes?.length
    ? p.cLayout.nodes
    : p.graph.nodes.filter((n) => n.cx !== undefined);

  const cEdges = p.cLayout?.edges?.length ? p.cLayout.edges : p.graph.edges;
  const w = Math.max(p.cLayout?.w ?? 560, 560);
  const h = Math.max(p.cLayout?.h ?? 460, 460);

  const svgHtml = buildCircularSVG(cNodes, cEdges, w, h);

  useEffect(() => {
    if (!wrapRef.current || !tooltipRef.current) return;
    const wrap = wrapRef.current;
    const tooltip = tooltipRef.current;

    wrap.querySelectorAll<SVGGElement>('.graph-node').forEach((el) => {
      el.addEventListener('mouseenter', (e) => {
        const id = el.dataset.id ?? '';
        const sub = el.dataset.sub ?? '';
        const type = el.dataset.type ?? '';
        const typeLbl = NODE_TYPE_LABELS[type] ?? type;
        const sysDesc = SYSTEM_PROGRAMS.get(id.toUpperCase());

        let html = `<strong>${id}</strong><br/><span style="opacity:.75;font-size:11px">${sub}</span><br/>`;
        if (sysDesc) {
          html += `<em style="opacity:.8;font-size:10px;display:block;max-width:220px;white-space:normal;margin-top:4px">${sysDesc}</em>`;
        } else if (type === 'prog') {
          html += `<em style="opacity:.55;font-size:10px">Click to open program hub</em>`;
        } else {
          html += `<em style="opacity:.55;font-size:10px">${typeLbl}</em>`;
        }

        tooltip.innerHTML = html;
        tooltip.style.display = 'block';
        const r = wrap.getBoundingClientRect();
        tooltip.style.left = ((e as MouseEvent).clientX - r.left + 14) + 'px';
        tooltip.style.top  = ((e as MouseEvent).clientY - r.top  - 10) + 'px';
        const node = cNodes.find((n) => n.id === id);
        if (node) setSelectedNode(node);
      });
      el.addEventListener('mousemove', (e) => {
        const r = wrap.getBoundingClientRect();
        tooltip.style.left = ((e as MouseEvent).clientX - r.left + 14) + 'px';
        tooltip.style.top  = ((e as MouseEvent).clientY - r.top  - 10) + 'px';
      });
      el.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
      el.addEventListener('click', () => {
        const id = el.dataset.id ?? '';
        const type = el.dataset.type ?? '';
        // System programs, data nodes, and copybooks are not navigable
        if (SYSTEM_PROGRAMS.has(id.toUpperCase()) || type === 'data' || type === 'cpy' || type === 'sys') return;
        if (type === 'hero' || type === 'prog' || type === 'asm') {
          router.push(`/programs/${encodeURIComponent(id)}`);
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgHtml]);

  const edgesByType = cEdges.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1; return acc;
  }, {});

  return (
    <>
      <div className="panel-title">Dependency View</div>
      <div className="panel-subtitle">
        Every call and data edge — structure determined by static analysis, not inferred. Click program nodes to open their hub.
      </div>

      <div className="dep-container">
        <div className="dep-header">
          <h2>{p.graph.title ?? `${p.name} Dependency Graph`}</h2>
          <span className="badge badge-deterministic">
            <span className="badge-dot" />
            {p.pipelineStatus?.graphSource === 'cast' ? 'CAST — deterministic' : 'Static analysis'}
          </span>
        </div>

        {/* Graph canvas */}
        <div
          ref={wrapRef}
          style={{
            position: 'relative',
            background: '#F8FAFD',
            borderRadius: 10,
            border: '1.5px solid #E5E7EB',
            overflow: 'auto',
            minHeight: 340,
          }}
        >
          <div
            style={{ minWidth: w, minHeight: h }}
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
          {/* Tooltip */}
          <div
            ref={tooltipRef}
            style={{
              display: 'none',
              position: 'absolute',
              background: '#1F3864',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 12,
              pointerEvents: 'none',
              maxWidth: 260,
              whiteSpace: 'normal',
              boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
              zIndex: 10,
              lineHeight: 1.6,
            }}
          />
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 12, padding: '12px 0 4px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#6B7280' }}>{cNodes.length} nodes</span>
          <span style={{ color: '#E5E7EB' }}>·</span>
          <span style={{ fontSize: 11, color: '#6B7280' }}>{cEdges.length} edges</span>
          <span style={{ color: '#E5E7EB' }}>·</span>
          <span style={{ fontSize: 11, color: '#6B7280' }}>
            {Math.round(p.graph.nodes?.length > 0
              ? (p.changeImpact?.coverage ?? 100)
              : 100)}% coverage
          </span>
          {Object.entries(edgesByType).map(([t, n]) => (
            <span key={t} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: '#F3F4F6', borderRadius: 20, padding: '2px 8px',
              fontSize: 10, fontWeight: 700, color: EC[t] ?? '#6B7280',
            }}>
              <span style={{ width: 16, height: 2, background: EC[t], display: 'inline-block', borderRadius: 1 }} />
              {EDGE_LABELS[t] ?? t} ×{n}
            </span>
          ))}
        </div>

        {/* Legend */}
        <div className="graph-legend" style={{ marginTop: 8 }}>
          {Object.entries(NC).map(([type, c]) => (
            <div key={type} className="legend-item">
              <div style={{ width: 14, height: 14, borderRadius: type === 'sys' ? 2 : '50%', background: c.fill, border: `2px solid ${c.stroke}`, flexShrink: 0 }} />
              {NODE_TYPE_LABELS[type] ?? type}
            </div>
          ))}
        </div>
      </div>

      <div className="honesty-note" style={{ maxWidth: 900 }}>
        <strong>Coverage note:</strong>{' '}
        {p.changeImpact?.coverageNote ?? `Dependency graph for ${p.name}. Hover nodes for details. Click COBOL program nodes to open their hub page.`}
      </div>

      {/* Node detail panel */}
      {selectedNode && (
        <div style={{
          marginTop: 12, background: '#fff', border: '1.5px solid #E5E7EB',
          borderRadius: 8, padding: '12px 16px', fontSize: 12, maxWidth: 500,
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1F3864', marginBottom: 4, fontFamily: 'Consolas, monospace' }}>
            {selectedNode.id}
          </div>
          {SYSTEM_PROGRAMS.get(selectedNode.id.toUpperCase()) && (
            <div style={{ color: '#6B7280', marginBottom: 6, fontSize: 12, lineHeight: 1.5 }}>
              {SYSTEM_PROGRAMS.get(selectedNode.id.toUpperCase())}
            </div>
          )}
          <div style={{ color: '#6B7280', marginBottom: 6 }}>{selectedNode.sub} · {NODE_TYPE_LABELS[selectedNode.type] ?? selectedNode.type}</div>
          <div style={{ color: '#9CA3AF', fontSize: 11 }}>
            Edges: {cEdges.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id).length} total
            ({cEdges.filter((e) => e.from === selectedNode.id).length} outbound,{' '}
            {cEdges.filter((e) => e.to === selectedNode.id).length} inbound)
          </div>
        </div>
      )}
    </>
  );
}
