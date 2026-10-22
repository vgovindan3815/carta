'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ProgramData, GraphNode, GraphEdge } from '@/lib/parser/types';

interface Props { program: ProgramData }

// ─── Colour maps ────────────────────────────────────────────────────────────
const EC: Record<string, string> = {
  call: '#1F3864', data: '#1C7293', cics: '#E07B39', dyn: '#9CA3AF',
  jcl: '#7C3AED', proc: '#0891B2', copy: '#059669', impact: '#E07B39',
  perform: '#6366F1',
};
const NC: Record<string, { fill: string; stroke: string; tx: string; sub: string }> = {
  hero:   { fill: '#1F3864', stroke: '#1C7293', tx: '#fff',    sub: 'rgba(255,255,255,.7)' },
  prog:   { fill: '#fff',    stroke: '#1F3864', tx: '#1F3864', sub: '#6B7280' },
  data:   { fill: '#EBF5EE', stroke: '#059669', tx: '#065F46', sub: '#34A678' },
  asm:    { fill: '#F5F3FF', stroke: '#7C3AED', tx: '#5B21B6', sub: '#7C3AED' },
  jcl:    { fill: '#FFF7ED', stroke: '#E07B39', tx: '#92400E', sub: '#D97706' },
  proc:   { fill: '#E0F2FE', stroke: '#0891B2', tx: '#0C4A6E', sub: '#0891B2' },
  cpy:    { fill: '#F0FDF4', stroke: '#059669', tx: '#065F46', sub: '#059669' },
  sys:    { fill: '#F9FAFB', stroke: '#9CA3AF', tx: '#6B7280', sub: '#9CA3AF' },
  impact: { fill: '#FFF7ED', stroke: '#E07B39', tx: '#92400E', sub: '#D97706' },
  para:   { fill: '#EEF2FF', stroke: '#6366F1', tx: '#3730A3', sub: '#6366F1' },
};
const EDGE_LABELS: Record<string, string> = {
  call: 'CALL', data: 'DATA', cics: 'CICS', dyn: 'DYN', jcl: 'JCL',
  proc: 'PROC', copy: 'COPY', impact: 'IMPACT', perform: 'PERFORM',
};
const NODE_TYPE_LABELS: Record<string, string> = {
  hero: 'Hero program', prog: 'COBOL program', data: 'DB2 / dataset',
  asm: 'Assembler module', jcl: 'JCL job', proc: 'JCL procedure',
  cpy: 'Copybook', sys: 'IBM system utility', impact: 'Impacted program',
  para: 'Paragraph',
};
const SYSTEM_PROGRAMS = new Set(['IEFBR14','IDCAMS','SORT','DFSORT','IEBGENER','IEBCOPY',
  'IEBUPDTE','IEHPROGM','IKJEFT01','DSNUTILB','DSNTIAD','DSNUPROC','ICETOOL','IEBPTPCH',
  'IEHLIST','IFASMFDP']);

// ─── Geometry helpers ────────────────────────────────────────────────────────
function circleEdge(cx: number, cy: number, r: number, tx: number, ty: number): [number, number] {
  const dx = tx - cx; const dy = ty - cy;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  return [cx + (dx / d) * r, cy + (dy / d) * r];
}
function edgePath(fn: GraphNode, tn: GraphNode): string {
  const fcx = fn.cx ?? 0; const fcy = fn.cy ?? 0; const fr = fn.r ?? 36;
  const tcx = tn.cx ?? 0; const tcy = tn.cy ?? 0; const tr = tn.r ?? 36;
  const [x1, y1] = circleEdge(fcx, fcy, fr, tcx, tcy);
  const [x2, y2] = circleEdge(tcx, tcy, tr, fcx, fcy);
  const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2;
  const dx = x2 - x1; const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const qx = mx + (-dy / len) * len * 0.18;
  const qy = my + ( dx / len) * len * 0.18;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${qx.toFixed(1)},${qy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}
function midPoint(p: string): [number, number] {
  const m = p.match(/M([\d.]+),([\d.]+).*Q([\d.]+),([\d.]+)\s+([\d.]+),([\d.]+)/);
  if (!m) return [0, 0];
  const [x1, y1, qx, qy, x2, y2] = m.slice(1).map(Number);
  return [0.25 * x1 + 0.5 * qx + 0.25 * x2, 0.25 * y1 + 0.5 * qy + 0.25 * y2];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function augmentWithImpacts(cLayout: ProgramData['cLayout'], items: ProgramData['changeImpact']['items']): ProgramData['cLayout'] {
  const existing = new Set(cLayout.nodes.map(n => n.id.toUpperCase()));
  const impactProgs = items.filter(it => {
    if (existing.has(it.prog.toUpperCase())) return false;
    const rel = (it.rel ?? '').toLowerCase();
    if (rel.includes('dataset') || rel.includes('table') || rel.includes('jcl') || rel.includes('file')) return false;
    return it.severity === 'critical' || it.severity === 'high' || it.severity === 'medium';
  });
  if (!impactProgs.length) return cLayout;
  const expand = 120;
  const newW = cLayout.w + expand * 2; const newH = cLayout.h + expand * 2;
  const shifted = cLayout.nodes.map(n => ({ ...n, cx: (n.cx ?? 0) + expand, cy: (n.cy ?? 0) + expand }));
  const cx0 = newW / 2; const cy0 = newH / 2;
  const outerR = Math.min(newW, newH) * 0.43;
  const impactNodes: GraphNode[] = impactProgs.map((it, i) => {
    const a = (2 * Math.PI * i / impactProgs.length) - Math.PI / 2;
    return { id: it.prog, label: it.prog.slice(0, 10), sub: it.severity + ' Impact', type: 'impact', cx: cx0 + outerR * Math.cos(a), cy: cy0 + outerR * Math.sin(a), r: 30 };
  });
  const heroId = shifted.find(n => n.type === 'hero')?.id ?? '';
  const impactEdges: GraphEdge[] = impactProgs.map(it => ({ from: heroId, to: it.prog, type: 'impact', label: it.severity }));
  return { w: newW, h: newH, nodes: [...shifted, ...impactNodes], edges: [...cLayout.edges, ...impactEdges] };
}

// ─── Sub-component: single node ──────────────────────────────────────────────
function NodeShape({ n, selected }: { n: GraphNode; selected: boolean }) {
  const C = NC[n.type] ?? NC.prog;
  const cx = n.cx ?? 0; const cy = n.cy ?? 0; const r = n.r ?? 36;
  const isHero = n.type === 'hero'; const isPara = n.type === 'para';
  const labelY = (n.type === 'data' || n.type === 'cpy') ? cy + 3 : cy - 4;
  const fontSize = isHero ? 12 : isPara ? 8 : (n.id.length > 8 ? 9 : 10.5);
  const selRing = selected ? <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke="#FBBF24" strokeWidth={2.5} strokeDasharray="4,2" /> : null;

  if (n.type === 'data' || n.type === 'cpy') {
    const ry = r * 0.28;
    return <g>
      {selRing}
      <ellipse cx={cx} cy={cy - r + ry} rx={r} ry={ry} fill={C.stroke} opacity={0.25} />
      <rect x={cx - r} y={cy - r + ry} width={r * 2} height={(r - ry) * 2} fill={C.fill} stroke={C.stroke} strokeWidth={1.5} />
      <ellipse cx={cx} cy={cy + r - ry} rx={r} ry={ry} fill={C.fill} stroke={C.stroke} strokeWidth={1.5} />
      <ellipse cx={cx} cy={cy - r + ry} rx={r} ry={ry} fill={C.fill} stroke={C.stroke} strokeWidth={1.5} />
      <text x={cx} y={labelY} textAnchor="middle" dominantBaseline="middle" fontFamily="Consolas,monospace" fontSize={fontSize} fontWeight={800} fill={C.tx}>{n.label}</text>
      {n.sub && n.sub !== n.label && <text x={cx} y={labelY + 13} textAnchor="middle" dominantBaseline="middle" fontFamily="Segoe UI,sans-serif" fontSize={7.5} fill={C.sub}>{n.sub.slice(0, 12)}</text>}
    </g>;
  }
  if (n.type === 'sys') {
    const pts = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i - Math.PI / 6; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
    return <g>
      {selRing}
      <polygon points={pts} fill={C.fill} stroke={C.stroke} strokeWidth={1.8} strokeDasharray="4,2" />
      <text x={cx} y={labelY} textAnchor="middle" dominantBaseline="middle" fontFamily="Consolas,monospace" fontSize={fontSize} fontWeight={800} fill={C.tx}>{n.label}</text>
    </g>;
  }
  const strokeW = isHero ? 3 : 1.8;
  const dash = n.type === 'asm' ? '6,3' : undefined;
  return <g>
    {selRing}
    <circle cx={cx} cy={cy} r={r} fill={C.fill} stroke={selected ? '#FBBF24' : C.stroke} strokeWidth={selected ? 2.5 : strokeW} strokeDasharray={dash} filter={isHero ? 'url(#shadowHero)' : 'url(#shadow)'} />
    {isHero && <circle cx={cx} cy={cy} r={r * 0.72} fill="none" stroke="rgba(28,114,147,0.35)" strokeWidth={1.5} />}
    <text x={cx} y={labelY} textAnchor="middle" dominantBaseline="middle" fontFamily="Consolas,monospace" fontSize={fontSize} fontWeight={800} fill={C.tx}>{n.label}</text>
    {n.sub && n.sub !== n.label && <text x={cx} y={labelY + 13} textAnchor="middle" dominantBaseline="middle" fontFamily="Segoe UI,sans-serif" fontSize={7.5} fill={C.sub}>{n.sub.slice(0, 12)}</text>}
  </g>;
}

// ─── Sub-component: code inspector panel ─────────────────────────────────────
function CodeInspector({
  inspected, program, loadedSource, loading, onLoad, onNavigate,
}: {
  inspected: { id: string; type: string; lineStart?: number; lineEnd?: number } | null;
  program: ProgramData;
  loadedSource: Record<string, string | null>;
  loading: string | null;
  onLoad: (name: string) => void;
  onNavigate: (url: string) => void;
}) {
  if (!inspected) {
    return (
      <div style={{ padding: 20, color: '#9CA3AF', fontSize: 12, textAlign: 'center', marginTop: 60 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>◎</div>
        <div>Click any node in the graph to inspect it</div>
        <div style={{ marginTop: 8, fontSize: 11 }}>Drag nodes to rearrange the layout</div>
      </div>
    );
  }

  const { id, type } = inspected;
  const C = NC[type] ?? NC.prog;

  // Paragraph node: show source lines from hero source
  if (type === 'para') {
    const paraName = id.replace(/^para:/, '');
    const para = program.internalFlow?.paragraphs.find(p => p.name === paraName);
    const heroSource = loadedSource[program.name];
    const lines = heroSource ? heroSource.split('\n') : null;
    const slice = lines && para ? lines.slice(para.lineStart - 1, para.lineEnd) : null;

    return (
      <div style={{ padding: 12, fontSize: 12 }}>
        <div style={{ fontFamily: 'Consolas,monospace', fontWeight: 800, color: C.tx, marginBottom: 4, background: C.fill, border: `1.5px solid ${C.stroke}`, borderRadius: 6, padding: '6px 10px' }}>
          ¶ {paraName}
        </div>
        {para && <div style={{ color: '#6B7280', fontSize: 11, marginBottom: 8 }}>Lines {para.lineStart}–{para.lineEnd} · {para.sectionName ?? 'no section'}</div>}
        {!heroSource && loading !== program.name && (
          <button onClick={() => onLoad(program.name)} style={{ padding: '5px 12px', background: '#1F3864', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>
            Load source to view code
          </button>
        )}
        {loading === program.name && <div style={{ color: '#9CA3AF', fontSize: 11 }}>Loading source…</div>}
        {slice && (
          <pre style={{ fontSize: 10, background: '#0F172A', color: '#E2E8F0', borderRadius: 6, padding: '10px 12px', overflow: 'auto', maxHeight: 400, margin: '8px 0 0', lineHeight: 1.5, fontFamily: 'Consolas,monospace' }}>
            {slice.map((line, i) => (
              <div key={i}>
                <span style={{ color: '#64748B', userSelect: 'none', display: 'inline-block', width: 36, textAlign: 'right', marginRight: 10 }}>{(para!.lineStart + i)}</span>
                {line}
              </div>
            ))}
          </pre>
        )}
        {heroSource && !slice && <div style={{ color: '#9CA3AF', fontSize: 11 }}>Paragraph source not found.</div>}
      </div>
    );
  }

  // Hero node
  if (type === 'hero') {
    return (
      <div style={{ padding: 12, fontSize: 12 }}>
        <div style={{ fontFamily: 'Consolas,monospace', fontWeight: 800, color: '#fff', background: '#1F3864', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
          {id} <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 10 }}>— this program</span>
        </div>
        <div style={{ color: '#6B7280', marginBottom: 8 }}>{program.loc} lines · {program.language} · {program.domain}</div>
        {program.internalFlow && (
          <div>
            <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>Paragraphs ({program.internalFlow.paragraphs.length})</div>
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {program.internalFlow.paragraphs.map(p => (
                <div key={p.name} style={{ padding: '3px 8px', borderLeft: '3px solid #6366F1', marginBottom: 3, fontSize: 11, fontFamily: 'Consolas,monospace', color: '#374151' }}>
                  {p.name} <span style={{ color: '#9CA3AF', fontFamily: 'sans-serif' }}>L{p.lineStart}–{p.lineEnd}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // External program node
  if (type === 'prog' || type === 'asm' || type === 'impact') {
    const src = loadedSource[id];
    return (
      <div style={{ padding: 12, fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontFamily: 'Consolas,monospace', fontWeight: 800, color: C.tx, background: C.fill, border: `1.5px solid ${C.stroke}`, borderRadius: 6, padding: '6px 10px', flex: 1 }}>
            {id}
          </div>
          <button onClick={() => onNavigate(`/programs/${encodeURIComponent(id)}`)} style={{ padding: '5px 10px', background: '#F3F4F6', border: '1.5px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>
            Open hub →
          </button>
        </div>
        <div style={{ color: '#6B7280', marginBottom: 10, fontSize: 11 }}>{NODE_TYPE_LABELS[type]}</div>
        {src === undefined && (
          <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontWeight: 700, color: '#065F46', marginBottom: 4 }}>Want to see the code for {id}?</div>
            <div style={{ color: '#6B7280', fontSize: 11, marginBottom: 8 }}>Load the source code stored for this module.</div>
            <button
              onClick={() => onLoad(id)}
              disabled={loading === id}
              style={{ padding: '6px 14px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
            >
              {loading === id ? 'Loading…' : `Load ${id} source`}
            </button>
          </div>
        )}
        {src === null && <div style={{ color: '#9CA3AF', fontSize: 11 }}>No source stored for {id}. Run an analysis on its hub page first.</div>}
        {src && (
          <pre style={{ fontSize: 10, background: '#0F172A', color: '#E2E8F0', borderRadius: 6, padding: '10px 12px', overflow: 'auto', maxHeight: 440, margin: 0, lineHeight: 1.5, fontFamily: 'Consolas,monospace' }}>
            {src.split('\n').slice(0, 300).map((line, i) => (
              <div key={i}>
                <span style={{ color: '#64748B', userSelect: 'none', display: 'inline-block', width: 36, textAlign: 'right', marginRight: 10 }}>{i + 1}</span>
                {line}
              </div>
            ))}
            {src.split('\n').length > 300 && <div style={{ color: '#64748B', marginTop: 6 }}>… {src.split('\n').length - 300} more lines</div>}
          </pre>
        )}
      </div>
    );
  }

  // Data / copybook / proc / sys node
  return (
    <div style={{ padding: 12, fontSize: 12 }}>
      <div style={{ fontFamily: 'Consolas,monospace', fontWeight: 800, color: C.tx, background: C.fill, border: `1.5px solid ${C.stroke}`, borderRadius: 6, padding: '6px 10px', marginBottom: 6 }}>{id}</div>
      <div style={{ color: '#6B7280' }}>{NODE_TYPE_LABELS[type] ?? type}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DependencyView({ program: p }: Props) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);

  const isCast = p.pipelineStatus?.graphSource === 'cast';
  const [viewMode, setViewMode] = useState<'structural' | 'impact'>(isCast ? 'structural' : 'impact');
  const [showParas, setShowParas] = useState(false);
  const [userPos, setUserPos] = useState<Record<string, { cx: number; cy: number }>>({});
  const [inspected, setInspected] = useState<{ id: string; type: string; lineStart?: number; lineEnd?: number } | null>(null);
  const [loadedSource, setLoadedSource] = useState<Record<string, string | null>>({});
  const [loadingSource, setLoadingSource] = useState<string | null>(null);

  // Drag tracking (refs — no re-renders during drag)
  const dragRef = useRef<{ id: string; origX: number; origY: number; startPx: number; startPy: number } | null>(null);
  const wasDragged = useRef(false);
  // Always-current copy of node positions for drag closure
  const cNodesRef = useRef<GraphNode[]>([]);

  // ── Layout computation ───────────────────────────────────────────────────
  const baseLayout = p.cLayout ?? {
    w: 560, h: 460,
    nodes: p.graph.nodes.filter(n => n.cx !== undefined),
    edges: p.graph.edges,
  };
  const activeLayout = viewMode === 'impact'
    ? augmentWithImpacts(baseLayout, p.changeImpact?.items ?? [])
    : baseLayout;

  // Apply user-moved positions
  const externalNodes: GraphNode[] = activeLayout.nodes.map(n => ({
    ...n,
    cx: userPos[n.id]?.cx ?? n.cx ?? 0,
    cy: userPos[n.id]?.cy ?? n.cy ?? 0,
  }));

  // Paragraph nodes arranged around the hero when Detail mode is on
  const paraNodes: GraphNode[] = useMemo(() => {
    if (!showParas || !p.internalFlow?.paragraphs.length) return [];
    const hero = externalNodes.find(n => n.type === 'hero');
    const hcx = hero?.cx ?? (activeLayout.w / 2);
    const hcy = hero?.cy ?? (activeLayout.h / 2);
    const paraR = Math.min(activeLayout.w, activeLayout.h) * 0.22;
    return p.internalFlow.paragraphs.map((para, i) => {
      const a = (2 * Math.PI * i / p.internalFlow!.paragraphs.length) - Math.PI / 2;
      const pid = `para:${para.name}`;
      return {
        id: pid,
        label: para.name.length > 9 ? para.name.slice(0, 8) + '…' : para.name,
        sub: `L${para.lineStart}`,
        type: 'para' as GraphNode['type'],
        cx: userPos[pid]?.cx ?? (hcx + paraR * Math.cos(a)),
        cy: userPos[pid]?.cy ?? (hcy + paraR * Math.sin(a)),
        r: 22,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showParas, p.internalFlow, activeLayout.w, activeLayout.h, userPos,
    // depend on hero position
    externalNodes.find(n => n.type === 'hero')?.cx,
    externalNodes.find(n => n.type === 'hero')?.cy,
  ]);

  // Paragraph perform edges
  const paraEdges: GraphEdge[] = useMemo(() => {
    if (!showParas || !p.internalFlow) return [];
    return p.internalFlow.performEdges.map(e => ({
      from: `para:${e.from}`,
      to:   `para:${e.to}`,
      type: 'perform' as GraphEdge['type'],
      label: e.isLoop ? 'LOOP' : undefined,
    }));
  }, [showParas, p.internalFlow]);

  const cNodes = [...externalNodes, ...paraNodes];
  const cEdges = [...activeLayout.edges, ...paraEdges];
  cNodesRef.current = cNodes;

  const w = Math.max(activeLayout.w, 560);
  const h = Math.max(activeLayout.h, 460);

  // Node map for edge rendering
  const nodeMap = useMemo(() => {
    const m: Record<string, GraphNode> = {};
    cNodes.forEach(n => { m[n.id] = n; });
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cNodes]);

  // ── Drag ─────────────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const nodeEl = (e.target as SVGElement).closest<SVGGElement>('[data-nid]');
    if (!nodeEl) return;
    const id = nodeEl.getAttribute('data-nid')!;
    const node = cNodesRef.current.find(n => n.id === id);
    if (!node) return;
    e.preventDefault();
    wasDragged.current = false;
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const scaleX = w / (rect.width  || 1);
    const scaleY = h / (rect.height || 1);
    dragRef.current = {
      id,
      origX: node.cx ?? 0,
      origY: node.cy ?? 0,
      startPx: (e.clientX - rect.left) * scaleX,
      startPy: (e.clientY - rect.top)  * scaleY,
    };

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current; if (!d) return;
      const r2 = svgRef.current!.getBoundingClientRect();
      const sx = w / (r2.width || 1); const sy = h / (r2.height || 1);
      const px = (ev.clientX - r2.left) * sx; const py = (ev.clientY - r2.top) * sy;
      const ddx = px - d.startPx; const ddy = py - d.startPy;
      if (Math.abs(ddx) > 3 || Math.abs(ddy) > 3) wasDragged.current = true;
      if (!wasDragged.current) return;
      setUserPos(prev => ({ ...prev, [d.id]: { cx: d.origX + ddx, cy: d.origY + ddy } }));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [w, h]);

  const handleNodeClick = useCallback((id: string, type: string) => {
    if (wasDragged.current) return;
    const para = type === 'para' ? p.internalFlow?.paragraphs.find(pr => `para:${pr.name}` === id) : undefined;
    setInspected({ id, type, lineStart: para?.lineStart, lineEnd: para?.lineEnd });
    // Auto-load hero source when clicking a paragraph
    if (type === 'para' && loadedSource[p.name] === undefined) {
      loadSource(p.name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.name, p.internalFlow, loadedSource]);

  const loadSource = useCallback(async (name: string) => {
    if (loadedSource[name] !== undefined) return;
    setLoadingSource(name);
    try {
      const res = await fetch(`/api/programs/${encodeURIComponent(name)}/source`);
      const data = await res.json();
      setLoadedSource(prev => ({ ...prev, [name]: data.sourceText ?? null }));
    } catch {
      setLoadedSource(prev => ({ ...prev, [name]: null }));
    } finally {
      setLoadingSource(null);
    }
  }, [loadedSource]);

  const resetLayout = useCallback(() => setUserPos({}), []);

  const edgesByType = cEdges.reduce<Record<string, number>>((a, e) => { a[e.type] = (a[e.type] ?? 0) + 1; return a; }, {});

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="panel-title">Dependency View</div>
      <div className="panel-subtitle">
        Click nodes to inspect · Drag to rearrange · Toggle Detail for paragraph breakdown
      </div>

      <div className="dep-container">
        {/* Toolbar */}
        <div className="dep-header" style={{ flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0 }}>{p.graph.title ?? `${p.name} Dependency Graph`}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className={`badge ${isCast ? 'badge-deterministic' : 'badge-llm'}`}>
              <span className="badge-dot" />
              {isCast ? 'CAST — deterministic' : 'LLM — inferred'}
            </span>
            {/* Structural / Impact toggle */}
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1.5px solid #E5E7EB', fontSize: 11, fontWeight: 700 }}>
              <button onClick={() => { setViewMode('structural'); setUserPos({}); }} style={{ padding: '4px 10px', border: 'none', cursor: 'pointer', background: viewMode === 'structural' ? '#1F3864' : '#F9FAFB', color: viewMode === 'structural' ? '#fff' : '#6B7280' }}>
                {isCast ? 'CAST Structural' : 'Structural'}
              </button>
              <button onClick={() => { setViewMode('impact'); setUserPos({}); }} style={{ padding: '4px 10px', border: 'none', cursor: 'pointer', background: viewMode === 'impact' ? '#E07B39' : '#F9FAFB', color: viewMode === 'impact' ? '#fff' : '#6B7280', borderLeft: '1.5px solid #E5E7EB' }}>
                + Impact Radius
              </button>
            </div>
            {/* Paragraph detail toggle */}
            {p.internalFlow?.paragraphs.length ? (
              <button onClick={() => setShowParas(v => !v)} style={{ padding: '4px 10px', border: '1.5px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', background: showParas ? '#EEF2FF' : '#F9FAFB', color: showParas ? '#3730A3' : '#6B7280', fontSize: 11, fontWeight: 700 }}>
                {showParas ? '¶ Hide Paragraphs' : `¶ Show ${p.internalFlow.paragraphs.length} Paragraphs`}
              </button>
            ) : null}
            {Object.keys(userPos).length > 0 && (
              <button onClick={resetLayout} style={{ padding: '4px 10px', border: '1.5px solid #E5E7EB', borderRadius: 6, background: '#F9FAFB', color: '#6B7280', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                ↺ Reset layout
              </button>
            )}
          </div>
        </div>

        {/* Main split view */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {/* Graph panel */}
          <div style={{ flex: '0 0 58%', background: '#F8FAFD', borderRadius: 10, border: '1.5px solid #E5E7EB', overflow: 'auto', minHeight: 340 }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${w} ${h}`}
              style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none', minHeight: 340 }}
              onPointerDown={handlePointerDown}
            >
              {/* Defs */}
              <defs>
                {Object.entries(EC).map(([t, col]) => (
                  <marker key={t} id={`arr-${t}`} markerWidth={8} markerHeight={8} refX={6} refY={3} orient="auto">
                    <path d="M0,0 L0,6 L8,3z" fill={col} opacity={0.85} />
                  </marker>
                ))}
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx={0} dy={2} stdDeviation={3} floodOpacity={0.13} />
                </filter>
                <filter id="shadowHero" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx={0} dy={3} stdDeviation={5} floodOpacity={0.22} />
                </filter>
              </defs>
              <rect width={w} height={h} fill="#F8FAFD" rx={8} />

              {/* Edges */}
              {cEdges.map((e, i) => {
                const fn = nodeMap[e.from]; const tn = nodeMap[e.to];
                if (!fn || !tn) return null;
                const d = edgePath(fn, tn);
                const [lx, ly] = midPoint(d);
                const col = EC[e.type] ?? '#9CA3AF';
                const da = e.type === 'dyn' || e.type === 'cics' ? '6,4' : e.type === 'perform' ? '3,3' : undefined;
                const rawLabel = e.label ?? EDGE_LABELS[e.type] ?? e.type;
                const lbl = rawLabel.length > 18 ? rawLabel.slice(0, 16) + '…' : rawLabel;
                const lw = lbl.length * 5 + 12;
                return (
                  <g key={i}>
                    <path d={d} fill="none" stroke={col} strokeWidth={1.8} strokeDasharray={da} markerEnd={`url(#arr-${e.type})`} opacity={e.type === 'dyn' ? 0.55 : 0.75} />
                    {lbl && <>
                      <rect x={lx - lw / 2} y={ly - 8} width={lw} height={13} rx={3} fill="white" fillOpacity={0.9} stroke={col} strokeWidth={0.5} />
                      <text x={lx} y={ly + 1} textAnchor="middle" dominantBaseline="middle" fontFamily="Consolas,monospace" fontSize={7.5} fill={col} fontWeight={700}>{lbl}</text>
                    </>}
                  </g>
                );
              })}

              {/* Nodes */}
              {cNodes.map(n => (
                <g
                  key={n.id}
                  data-nid={n.id}
                  style={{ cursor: 'grab' }}
                  onClick={() => handleNodeClick(n.id, n.type)}
                >
                  <NodeShape n={n} selected={inspected?.id === n.id} />
                </g>
              ))}
            </svg>
          </div>

          {/* Code inspector panel */}
          <div style={{ flex: '0 0 40%', background: '#fff', borderRadius: 10, border: '1.5px solid #E5E7EB', minHeight: 340, maxHeight: 560, overflow: 'auto' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #F3F4F6', fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Code Inspector
            </div>
            <CodeInspector
              inspected={inspected}
              program={p}
              loadedSource={loadedSource}
              loading={loadingSource}
              onLoad={loadSource}
              onNavigate={router.push}
            />
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 12, padding: '10px 0 4px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#6B7280' }}>{cNodes.length} nodes</span>
          <span style={{ color: '#E5E7EB' }}>·</span>
          <span style={{ fontSize: 11, color: '#6B7280' }}>{cEdges.length} edges</span>
          {Object.entries(edgesByType).map(([t, n]) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F3F4F6', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: EC[t] ?? '#6B7280' }}>
              <span style={{ width: 16, height: 2, background: EC[t], display: 'inline-block', borderRadius: 1 }} />
              {EDGE_LABELS[t] ?? t} ×{n}
            </span>
          ))}
        </div>

        {/* Legend */}
        <div className="graph-legend" style={{ marginTop: 8 }}>
          {Object.entries(NC).filter(([t]) => t !== 'para' || showParas).map(([type, c]) => (
            <div key={type} className="legend-item">
              <div style={{ width: 14, height: 14, borderRadius: type === 'sys' ? 2 : '50%', background: c.fill, border: `2px solid ${c.stroke}`, flexShrink: 0 }} />
              {NODE_TYPE_LABELS[type] ?? type}
            </div>
          ))}
        </div>
      </div>

      <div className="honesty-note" style={{ maxWidth: 900 }}>
        <strong>Coverage note:</strong>{' '}
        {p.changeImpact?.coverageNote ?? `Dependency graph for ${p.name}.`}
        {showParas && p.internalFlow && ` · ${p.internalFlow.paragraphs.length} paragraphs shown (purple rings).`}
      </div>
    </>
  );
}
