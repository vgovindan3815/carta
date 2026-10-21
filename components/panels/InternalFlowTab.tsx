'use client';

import type { InternalFlow, GraphEdge, GraphNode } from '@/lib/parser/types';

interface Props {
  programName: string;
  internalFlow: InternalFlow;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
}

interface TreeNode {
  name: string;
  children: TreeNode[];
  isLoop: boolean;
  level: number;
}

function buildTree(entryPara: string, performEdges: InternalFlow['performEdges'], maxDepth = 3): TreeNode {
  const seen = new Set<string>();

  function build(name: string, depth: number): TreeNode {
    seen.add(name);
    const children: TreeNode[] = [];
    if (depth < maxDepth) {
      for (const e of performEdges) {
        if (e.from === name && !seen.has(e.to)) {
          children.push(build(e.to, depth + 1));
        }
      }
    }
    const isLoop = performEdges.some((e) => e.to === name && e.isLoop);
    return { name, children, isLoop, level: depth };
  }

  return build(entryPara, 0);
}

function nodeColor(name: string, isEntry: boolean, isLoop: boolean): string {
  if (isEntry) return '#534AB7';
  if (isLoop) return '#BA7517';
  if (/^9[0-9]{3}/.test(name)) return '#0F6E56';
  if (/^0{4}/.test(name) || /^MAIN/.test(name)) return '#185FA5';
  return '#5F5E5A';
}

function flattenTree(root: TreeNode): TreeNode[] {
  const result: TreeNode[] = [root];
  for (const c of root.children) result.push(...flattenTree(c));
  return result;
}

export default function InternalFlowTab({ programName, internalFlow, graph }: Props) {
  const tree = buildTree(internalFlow.entryParagraph, internalFlow.performEdges);
  const allTreeNodes = flattenTree(tree).slice(0, 14);

  const SVG_W = 660;
  const ROW_H = 100;
  const NODE_W = 140;
  const NODE_H = 44;

  interface SvgNode { name: string; x: number; y: number; w: number; h: number; color: string; isLoop: boolean; }
  interface SvgEdge { x1: number; y1: number; x2: number; y2: number; }

  const svgNodes: SvgNode[] = [];
  const svgEdges: SvgEdge[] = [];
  const nodeMap = new Map<string, SvgNode>();

  const levelMap = new Map<number, TreeNode[]>();
  for (const n of allTreeNodes) {
    if (!levelMap.has(n.level)) levelMap.set(n.level, []);
    levelMap.get(n.level)!.push(n);
  }

  const maxLevel = levelMap.size > 0 ? Math.max(...Array.from(levelMap.keys())) : 0;
  const SVG_H = (maxLevel + 1) * ROW_H + NODE_H + 40;

  for (const [level, nodes] of levelMap) {
    const totalW = nodes.length * NODE_W + (nodes.length - 1) * 20;
    const startX = Math.max(20, (SVG_W - totalW) / 2);
    const y = 24 + level * ROW_H;
    nodes.forEach((n, i) => {
      const w = level === 0 ? 200 : NODE_W;
      const x = startX + i * (NODE_W + 20);
      const color = nodeColor(n.name, n.name === internalFlow.entryParagraph, n.isLoop);
      const sn: SvgNode = { name: n.name, x, y, w, h: NODE_H, color, isLoop: n.isLoop };
      svgNodes.push(sn);
      nodeMap.set(n.name, sn);
    });
  }

  for (const e of internalFlow.performEdges) {
    const from = nodeMap.get(e.from);
    const to = nodeMap.get(e.to);
    if (from && to) {
      svgEdges.push({
        x1: from.x + from.w / 2,
        y1: from.y + from.h,
        x2: to.x + to.w / 2,
        y2: to.y,
      });
    }
  }

  const callEdges = graph.edges.filter((e) => e.type === 'call' || e.type === 'dyn');
  const dataEdges = graph.edges.filter((e) => e.type === 'data' || e.type === 'cics');
  const sqlEdges = dataEdges.filter((e) => e.label === 'SQL');
  const fileEdges = dataEdges.filter((e) => e.label === 'READ' || e.label === 'WRITE' || e.label === 'FILE');
  const cicsEdges = dataEdges.filter((e) => e.type === 'cics');

  const totalHidden = internalFlow.paragraphs.length - allTreeNodes.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
        {[
          { label: 'Paragraphs', val: internalFlow.paragraphs.length },
          { label: 'PERFORM edges', val: internalFlow.performEdges.length },
          { label: 'External calls', val: callEdges.length },
          { label: 'SQL tables', val: sqlEdges.length },
        ].map((m) => (
          <div key={m.label} style={{ background: 'var(--surface-1)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Paragraph control flow */}
      <div style={{ background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          Paragraph control flow
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 'auto' }}>
            {internalFlow.paragraphs.length} paragraphs · {internalFlow.performEdges.length} PERFORM edges
          </span>
        </div>

        <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} role="img"
          aria-label={`Paragraph flowchart for ${programName}`}>
          <defs>
            <marker id="pf-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </marker>
          </defs>
          {svgEdges.map((e, i) => (
            <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              stroke="#888" strokeWidth="1" markerEnd="url(#pf-arrow)"/>
          ))}
          {svgNodes.map((n) => (
            <g key={n.name}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="8"
                fill={n.color} fillOpacity="0.15" stroke={n.color} strokeWidth="1"/>
              <text x={n.x + n.w / 2} y={n.y + (n.h / 2) - (n.isLoop ? 7 : 0)}
                textAnchor="middle" dominantBaseline="central"
                fontSize="12" fontWeight="500" fill={n.color}>
                {n.name.length > 16 ? n.name.slice(0, 15) + '…' : n.name}
              </text>
              {n.isLoop && (
                <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 9}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize="10" fill={n.color} opacity="0.8">
                  ↻ loop
                </text>
              )}
            </g>
          ))}
          {totalHidden > 0 && (
            <text x={SVG_W / 2} y={SVG_H - 8} textAnchor="middle"
              fontSize="11" fill="#888">
              +{totalHidden} more paragraph{totalHidden !== 1 ? 's' : ''} not shown
            </text>
          )}
        </svg>

        <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
          {[
            { color: '#534AB7', label: 'Entry' },
            { color: '#185FA5', label: 'Control' },
            { color: '#0F6E56', label: 'Cleanup / error' },
            { color: '#BA7517', label: 'Loop' },
            { color: '#5F5E5A', label: 'Worker' },
          ].map((l) => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, flexShrink: 0 }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* External call chain */}
      {callEdges.length > 0 && (
        <div style={{ background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>
            External call chain
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {callEdges.map((e, i) => (
              <div key={i} style={{
                background: 'var(--surface-1)', border: '0.5px solid var(--border)',
                borderRadius: 8, padding: '8px 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
              }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {e.to}
                  </span>
                  {e.sourcePara && (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>
                      from {e.sourcePara}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <span style={{
                    background: e.type === 'call' ? 'var(--bg-success, #d1fae5)' : 'var(--bg-warning, #fef3c7)',
                    color: e.type === 'call' ? 'var(--text-success, #065f46)' : 'var(--text-warning, #92400e)',
                    fontSize: 10, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap',
                  }}>
                    {e.type === 'call' ? 'static · 100%' : 'dynamic · 71%'}
                  </span>
                  {e.label && (
                    <span style={{ background: 'var(--bg-accent, #ede9fe)', color: 'var(--text-accent, #5b21b6)', fontSize: 10, padding: '2px 7px', borderRadius: 10 }}>
                      {e.label}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data access */}
      {dataEdges.length > 0 && (
        <div style={{ background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            Data access
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 'auto' }}>
              {sqlEdges.length > 0 && `${sqlEdges.length} SQL`}
              {fileEdges.length > 0 && ` · ${fileEdges.length} file${fileEdges.length !== 1 ? 's' : ''}`}
              {cicsEdges.length > 0 && ` · ${cicsEdges.length} CICS`}
            </span>
          </div>

          {sqlEdges.length > 0 && (
            <div style={{ marginBottom: fileEdges.length > 0 || cicsEdges.length > 0 ? 12 : 0 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>SQL</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {sqlEdges.map((e, i) => (
                  <div key={i} style={{ background: 'var(--surface-1)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--text-primary)' }}>{e.to}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{e.label ?? 'SQL'}</div>
                    {e.sourcePara && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{e.sourcePara}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {fileEdges.length > 0 && (
            <div style={{ marginBottom: cicsEdges.length > 0 ? 12 : 0 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Files</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {fileEdges.map((e, i) => (
                  <div key={i} style={{ background: 'var(--surface-1)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--text-primary)' }}>{e.to}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{e.label ?? 'FILE'}</div>
                    {e.sourcePara && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{e.sourcePara}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {cicsEdges.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>CICS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {cicsEdges.map((e, i) => (
                  <div key={i} style={{ background: 'var(--surface-1)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--text-primary)' }}>{e.to}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{e.label ?? 'CICS'}</div>
                    {e.sourcePara && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{e.sourcePara}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
