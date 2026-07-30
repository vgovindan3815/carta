/* ── Shared types for MAVEN/CARTA ── */

export interface ProgramChip {
  label: string;
  val: string;
}

export interface CitationRef {
  label: string;
  edge: string;
}

export interface BusinessRule {
  text: string;
  citations: CitationRef[];
}

export interface BusinessSection {
  section: string;
  rules: BusinessRule[];
}

export interface ChangeImpactItem {
  prog: string;
  rel: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  reason: string;
  edge: string;
}

export interface ChangeImpact {
  query: string;
  coverage: number;
  coverageNote: string;
  items: ChangeImpactItem[];
}

export interface SpecSection {
  num: string;
  title: string;
  content: string;
}

export interface ProgramSpec {
  title: string;
  subtitle: string;
  sections: SpecSection[];
}

// ── Circular (overview) graph ──
export interface CircularNode {
  id: string;
  label: string;
  sub: string;
  type: 'hero' | 'prog' | 'data' | 'asm';
  cx: number;
  cy: number;
  r: number;
}

export interface CircularEdge {
  from: string;
  to: string;
  type: 'call' | 'data' | 'cics' | 'dyn';
}

export interface CircularLayout {
  w: number;
  h: number;
  nodes: CircularNode[];
  edges: CircularEdge[];
}

// ── Rectangular (dependency) graph ──
export interface GraphNode {
  id: string;
  label: string;
  sub: string;
  type: 'hero' | 'prog' | 'data' | 'asm';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'call' | 'data' | 'cics' | 'dyn';
  label: string;
  fd: string;
  td: string;
}

export interface DependencyGraph {
  title: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── Full program data ──
export interface ProgramData {
  name: string;
  language: string;
  loc: number;
  domain: string;
  desc: string;
  chips: ProgramChip[];
  overviewQuery?: string;
  overviewNarrative?: string;
  overviewEdges?: string[];
  cLayout: CircularLayout;
  graph: DependencyGraph;
  businessRules: BusinessSection[];
  changeImpact: ChangeImpact;
  spec: ProgramSpec;
  status?: 'analyzed' | 'not_analyzed' | 'analyzing';
  lastAnalyzedAt?: string;
}

// ── DB row types ──
export interface RepoRecord {
  id: string;
  githubUrl: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  createdAt: string;
}

export interface ProgramRecord {
  id: string;
  repoId: string;
  name: string;
  language: string;
  loc: number;
  filePath: string;
  domain: string;
  desc: string;
  status: 'not_analyzed' | 'analyzing' | 'analyzed';
  data: ProgramData | null;
  lastAnalyzedAt: string | null;
  createdAt: string;
}

export interface JobRecord {
  id: string;
  programId: string;
  status: 'pending' | 'running' | 'done' | 'error';
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── SSE log line ──
export interface LogLine {
  lv: 'INFO' | 'CALL' | 'SQL' | 'DATA' | 'WARN' | 'LLM' | 'DONE';
  t: string;
}

// ── API response types ──
export interface ProgramListItem {
  name: string;
  language: string;
  loc: number;
  domain: string;
  desc: string;
  status: string;
  lastAnalyzedAt: string | null;
}
