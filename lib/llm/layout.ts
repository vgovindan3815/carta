import type { GraphNode, GraphEdge, CircularLayout } from '../parser/types';

export function layoutCircular(
  nodes: Pick<GraphNode, 'id' | 'label' | 'sub' | 'type'>[],
  edges: GraphEdge[],
  W = 580,
  H = 468
): CircularLayout {
  const hero = nodes.find((n) => n.type === 'hero') ?? nodes[0];
  const progs = nodes.filter((n) => n.type === 'prog' || n.type === 'asm');
  const datas = nodes.filter((n) => n.type === 'data');

  const cx = W / 2;
  const cy = H / 2 - 10;
  const laid: GraphNode[] = [];

  if (hero) laid.push({ ...hero, cx, cy, r: 44 });

  const innerR = Math.min(155, W / 2 - 65);
  progs.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(progs.length, 1) - Math.PI / 2;
    laid.push({
      ...n,
      cx: Math.round(cx + innerR * Math.cos(angle)),
      cy: Math.round(cy + innerR * Math.sin(angle)),
      r: n.type === 'asm' ? 23 : 30,
    });
  });

  const outerR = Math.min(230, W / 2 - 30);
  datas.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(datas.length, 1) - Math.PI / 6;
    laid.push({
      ...n,
      cx: Math.round(cx + outerR * Math.cos(angle)),
      cy: Math.round(cy + outerR * Math.sin(angle)),
      r: 24,
    });
  });

  return { w: W, h: H, nodes: laid, edges };
}
