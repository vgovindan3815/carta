import type { InternalFlow, DependencyGraph } from '@/lib/parser/types';

function nodeId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return `n${Math.abs(h).toString(36)}`;
}

function escLabel(s: string): string {
  return s.replace(/"/g, '#quot;');
}

/** Internal paragraph control-flow diagram */
export function internalFlowMermaid(flow: InternalFlow): string {
  const lines: string[] = ['flowchart TD'];
  for (const para of flow.paragraphs) {
    const id = nodeId(para.name);
    lines.push(`  ${id}["${escLabel(para.name)}"]`);
  }
  for (const edge of flow.performEdges) {
    const src = nodeId(edge.from);
    const dst = nodeId(edge.to);
    const label = edge.condition ? `|"${escLabel(edge.condition)}"|` : '';
    lines.push(`  ${src} -->${label} ${dst}`);
  }
  return lines.join('\n');
}

/** Call graph for a program — program-to-program calls */
export function callGraphMermaid(graph: DependencyGraph, programName: string): string {
  const lines: string[] = ['flowchart LR'];
  const hero = nodeId(programName);
  lines.push(`  ${hero}["${escLabel(programName)}"]`);
  const seen = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.type !== 'call' && edge.type !== 'dyn') continue;
    const dst = nodeId(edge.to);
    if (!seen.has(edge.to)) {
      lines.push(`  ${dst}["${escLabel(edge.to)}"]`);
      seen.add(edge.to);
    }
    if (edge.type === 'dyn') {
      lines.push(`  ${hero} -.->|"dyn"| ${dst}`);
    } else {
      lines.push(`  ${hero} --> ${dst}`);
    }
  }
  return lines.join('\n');
}

/** Data access diagram — tables/files read/written by a program */
export function dataAccessMermaid(graph: DependencyGraph, programName: string): string {
  const lines: string[] = ['flowchart LR'];
  const hero = nodeId(programName);
  lines.push(`  ${hero}["${escLabel(programName)}"]`);
  const seen = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.type !== 'data' && (edge.type as string) !== 'sql' && edge.type !== 'cics') continue;
    const dst = nodeId(edge.to);
    if (!seen.has(edge.to)) {
      lines.push(`  ${dst}[("${escLabel(edge.to)}")]`);
      seen.add(edge.to);
    }
    const label = edge.label ? `|"${escLabel(edge.label)}"|` : '';
    lines.push(`  ${hero} -->${label} ${dst}`);
  }
  return lines.join('\n');
}
