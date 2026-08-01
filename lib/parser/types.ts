export type NodeType = 'hero' | 'prog' | 'data' | 'asm' | 'jcl' | 'proc' | 'cpy' | 'sys';
export type EdgeType = 'call' | 'data' | 'cics' | 'dyn' | 'jcl' | 'proc' | 'copy';

export interface GraphNode {
  id: string;
  label: string;
  sub: string;
  type: NodeType;
  // rectangular layout (detail tab)
  x?: number; y?: number; w?: number; h?: number;
  // circular layout (overview)
  cx?: number; cy?: number; r?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: EdgeType;
  label?: string;
  fd?: string; // from-direction for rect graph
  td?: string; // to-direction for rect graph
  confidence?: number; // 0-100, for dynamic calls
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  coveragePct: number;
}

export interface CircularLayout {
  w: number; h: number;
  nodes: GraphNode[]; // cx,cy,r set
  edges: GraphEdge[];
}

export interface BusinessRule {
  text: string;
  citations: { label: string; edge: string }[];
}

export interface BusinessRulesSection {
  section: string;
  rules: BusinessRule[];
}

export interface ChangeImpactItem {
  prog: string;
  rel: string;
  severity: 'critical' | 'high' | 'medium' | 'unknown';
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
  num: number;
  title: string;
  content: string; // HTML
}

export interface ModernizationSpec {
  title: string;
  subtitle: string;
  generatedAt?: string;
  sections: SpecSection[];
}

export interface MetaChip { label: string; val: string; }

export type PipelineStepStatus = 'success' | 'fail' | 'skip' | 'pending';

export interface PipelineStatus {
  cast: PipelineStepStatus;
  github: PipelineStepStatus;
  llm: PipelineStepStatus;
  docs: PipelineStepStatus;
  graphSource: 'cast' | 'llm' | 'parser';
}

export interface ProgramData {
  name: string;
  language: string;
  loc: number;
  domain: string;
  desc: string;
  chips: MetaChip[];
  overviewQuery: string;
  overviewNarrative: string;
  overviewEdges: string[];
  cLayout: CircularLayout;
  graph: { title: string; nodes: GraphNode[]; edges: GraphEdge[] };
  businessRules: BusinessRulesSection[];
  changeImpact: ChangeImpact;
  spec: ModernizationSpec;
  pipelineStatus?: PipelineStatus;
  version?: number;
}

export interface CopybookField {
  level: number;
  name: string;
  pic?: string;
  occurs?: number;
}

export interface CopybookDefinition {
  name: string;
  source: string;
  fields: CopybookField[];
}

export interface ParsedCobolProgram {
  name: string;
  language: 'COBOL' | 'HLASM';
  loc: number;
  source: string;
  graph: DependencyGraph;
  linkageSection?: string;
}

export interface SseLogLine {
  lv: 'INFO' | 'CALL' | 'SQL' | 'DATA' | 'WARN' | 'LLM' | 'DONE';
  t: string; // text (may contain HTML spans)
  d: number; // ms delay from phase start (0 = immediate)
}
