import type { DependencyGraph, InternalFlow } from '@/lib/parser/types';

export interface ContextManifest {
  programName: string;
  language: string;
  loc: number;
  callees: string[];
  callers: string[];
  dataAccesses: Array<{ target: string; type: string; label?: string }>;
  paragraphs?: string[];
  copybooks: string[];
  hasBizRules: boolean;
  factKeys: string[];
}

export function buildContextManifest(
  programName: string,
  graph: DependencyGraph,
  internalFlow: InternalFlow | undefined,
  meta: { language: string; loc: number; hasBizRules: boolean; callers: string[] }
): ContextManifest {
  const callees = graph.edges
    .filter(e => e.type === 'call' || e.type === 'dyn')
    .map(e => e.to);

  const dataAccesses = graph.edges
    .filter(e => e.type === 'data' || e.type === 'cics')
    .map(e => ({ target: e.to, type: e.type, label: e.label }));

  const copybooks = graph.edges
    .filter(e => e.type === 'copy')
    .map(e => e.to);

  const paragraphs = internalFlow?.paragraphs.map(p => p.name);

  const manifest: ContextManifest = {
    programName,
    language: meta.language,
    loc: meta.loc,
    callees: [...new Set(callees)],
    callers: meta.callers,
    dataAccesses,
    paragraphs,
    copybooks: [...new Set(copybooks)],
    hasBizRules: meta.hasBizRules,
    factKeys: [],
  };

  manifest.factKeys = [
    `${programName}:language`,
    `${programName}:loc`,
    ...manifest.callees.map(c => `${programName}:calls:${c}`),
    ...manifest.callers.map(c => `${programName}:calledby:${c}`),
    ...manifest.dataAccesses.map(d => `${programName}:data:${d.target}`),
    ...manifest.copybooks.map(c => `${programName}:copy:${c}`),
    ...(manifest.paragraphs ?? []).map(p => `${programName}:para:${p}`),
    ...(manifest.hasBizRules ? [`${programName}:bizrules`] : []),
  ];

  return manifest;
}
