/**
 * Report format produced by the engine CLI.
 *
 * The format is a superset of MKP's existing CastProgram[] JSON so that
 * the output can be imported immediately via POST /api/cast with zero
 * MKP code changes.  Additional fields (evidence, kgEdges, diagnostics)
 * are ignored by the current importer and will be consumed once Phase 2
 * enriches MKP's import route.
 */

import type { KgNode, KgEdge, EvidenceRecord, UnresolvedReference, Diagnostic } from './ontology';

// ─── Per-artifact report ──────────────────────────────────────────────────────

export interface ArtifactReport {
  // ── MKP-compatible fields (recognised by POST /api/cast today) ──
  name: string;                       // PROGRAM-ID / JOB name / PROC name
  language: string;                   // COBOL | PLI | HLASM | JCL | PROC | EASYTRIEVE
  loc: number;
  filePath: string;
  domain?: string;
  desc?: string;
  coveragePct: number;                // % of call-edges that are DETERMINISTIC or RESOLVED

  /** Simplified node/edge arrays for MKP's current circular-layout view */
  nodes: MkpCompatNode[];
  edges: MkpCompatEdge[];

  // ── Engine v2 fields (consumed by Phase 2 importer) ──
  kgNodes: KgNode[];
  kgEdges: KgEdge[];
  evidenceRecords: EvidenceRecord[];
  unresolvedRefs: UnresolvedReference[];
  diagnostics: Diagnostic[];

  /** Paragraph-level CFG from the parser (replaces LLM Mermaid CFG) */
  internalFlow?: ProgramFlow;
}

// ─── MKP-compatible simplified shapes (same as lib/parser/types.ts) ──────────

export interface MkpCompatNode {
  id: string;
  label: string;
  sub: string;
  type: 'hero' | 'prog' | 'data' | 'asm' | 'jcl' | 'proc' | 'cpy' | 'sys' | 'missing';
}

export interface MkpCompatEdge {
  from: string;
  to: string;
  type: 'call' | 'data' | 'cics' | 'dyn' | 'jcl' | 'proc' | 'copy' | 'perform';
  label?: string;
  confidence?: number;
  sourcePara?: string;
  /** New: semantic confidence level */
  confidenceLevel?: 'DETERMINISTIC' | 'RESOLVED' | 'CANDIDATE' | 'UNRESOLVED' | 'MISSING' | 'EXTERNAL';
  /** New: source evidence (line number in the originating artifact) */
  evidenceLine?: number;
}

// ─── Internal flow / CFG (deterministic, from parser) ─────────────────────────

export interface ParagraphInfo {
  name: string;
  lineStart: number;
  lineEnd: number;
  sectionName?: string;
}

export interface CfgEdge {
  from: string;
  to: string;
  edgeType: 'FALLTHROUGH' | 'TRUE' | 'FALSE' | 'WHEN' | 'OTHERWISE' | 'LOOP_BACK'
          | 'PERFORM' | 'RETURN' | 'GOTO' | 'TERMINATE';
  condition?: string;
  evidenceLine?: number;
}

export interface ProgramFlow {
  paragraphs: ParagraphInfo[];
  sections: string[];
  cfgEdges: CfgEdge[];
  entryParagraph: string;
}

// ─── Top-level report ─────────────────────────────────────────────────────────

export interface EngineReport {
  /** Engine version — used for incremental analysis invalidation */
  engineVersion: string;
  /** ISO timestamp */
  generatedAt: string;
  /** Source root that was analyzed */
  sourceRoot: string;
  /** Total artifacts ingested */
  artifactCount: number;
  /** Parsed + fully resolved */
  resolvedCount: number;
  /** Programs, JCL jobs, PROCs, copybooks, etc. */
  artifacts: ArtifactReport[];
  /** Repository-level diagnostics */
  diagnostics: Diagnostic[];
  /** Summary metrics (spec §31) */
  metrics: AnalysisMetrics;
}

export interface AnalysisMetrics {
  artifactsIngested: number;
  artifactsParsed: number;
  artifactsPartiallyParsed: number;
  artifactsFailed: number;
  referencesDetected: number;
  referencesDeterministic: number;
  referencesResolved: number;
  referencesCandidate: number;
  referencesUnresolved: number;
  missingTargets: number;
  externalTargets: number;
}
