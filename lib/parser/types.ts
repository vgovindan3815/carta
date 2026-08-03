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

// ---------------------------------------------------------------------------
// v2.2 — Rule Card (§2.1)
// ---------------------------------------------------------------------------

export interface RuleCard {
  id: string; // RULE-NNN
  name: string;
  category: 'Calculation' | 'Validation' | 'Lifecycle' | 'Policy';
  priority: 'P0' | 'P1' | 'P2';
  source_line_start: number;
  source_line_end: number;
  plain_english: string;
  given: string;
  when: string;
  then: string;
  parameters: Record<string, string>;
  edge_cases: string[];
  suspected_defect: string | null;
  confidence: 'High' | 'Medium' | 'Low';
  confidence_note: string | null;
  citationVerified?: boolean; // set by post-extraction verification pass
}

// ---------------------------------------------------------------------------
// v2.2 — DataObject catalog (§2.2)
// ---------------------------------------------------------------------------

export interface DataObjectField {
  name: string;
  pic?: string;
  level: number;
  occurs: number | null;
}

export interface DataObject {
  name: string;
  kind: 'working-storage' | 'copybook' | 'linkage-section' | 'sql-result' | 'file-record';
  source_line: number;
  fields: DataObjectField[];
  consumed_by_rules: string[];
  produced_by_rules: string[];
}

// ---------------------------------------------------------------------------
// v2.2 — Persona flows + observations (§2.3)
// ---------------------------------------------------------------------------

export interface PersonaFlowStep {
  label: string;
  nodes: string[];
}

export interface PersonaFlow {
  name: string;
  persona: string;
  description: string;
  smePending: boolean;
  steps: PersonaFlowStep[];
}

// ---------------------------------------------------------------------------
// v2.2 — InjectionFlag (§2.4)
// ---------------------------------------------------------------------------

export interface InjectionFlag {
  source_line: number;
  content_preview: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// v2.2 — ModuleFacts aggregate (§2, new moduleFacts table)
// ---------------------------------------------------------------------------

export interface ModuleFacts {
  entryPoints: string[];
  businessRules: RuleCard[];
  decisionPoints: Array<{
    condition: string;
    outcomes: string[];
    source_line_start: number;
    source_line_end: number;
  }>;
  dataTransformations: Array<{
    description: string;
    source_line_start: number;
    source_line_end: number;
  }>;
  exceptionPaths: Array<{
    trigger: string;
    handler: string;
    source_line: number;
  }>;
  dataObjects: DataObject[];
  outOfScopeRefs: Array<{ name: string; ref_type: string; source_line: number }>;
  flows: PersonaFlow[];
  observations: string[];
  injectionFlags: InjectionFlag[];
}

// ---------------------------------------------------------------------------
// v2.2 — Graph discrepancy (static parser vs LLM)
// ---------------------------------------------------------------------------

export interface GraphDiscrepancy {
  staticEdge: { from: string; to: string; type: string };
  observation: string;
  confidence: 'high' | 'medium' | 'low';
  status?: 'unreviewed' | 'confirmed_static' | 'confirmed_llm' | 'dismissed';
}

// ---------------------------------------------------------------------------
// v2.2 — Tier 2 capability types
// ---------------------------------------------------------------------------

export interface AppCapability {
  id: string;
  name: string;
  description: string;
  memberPrograms: string[];
  dataDomains: string[];
  p0RuleCount: number;
  observations: string[];
}
