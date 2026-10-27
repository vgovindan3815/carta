/**
 * Canonical ontology for the Deterministic Mainframe Knowledge Graph Engine.
 * Derived from spec §6 (entity types) and §7 (relationship types).
 *
 * These enums replace the flat NodeType / EdgeType strings used in MKP's
 * lib/parser/types.ts with a semantically complete set.
 */

// ─── Confidence / Resolution Model (spec §9) ─────────────────────────────────

export type Confidence =
  | 'DETERMINISTIC' // Explicit source proves the relationship
  | 'RESOLVED'      // Multi-step deterministic resolution found one target
  | 'CANDIDATE'     // Bounded set of possible targets, not unique
  | 'UNRESOLVED'    // Dependency exists but no target can be proven
  | 'MISSING'       // Target name known, artifact not supplied
  | 'EXTERNAL';     // Intentionally outside analyzed source set

// ─── Node Types (spec §6) ────────────────────────────────────────────────────

// Portfolio
export type PortfolioNodeType = 'PORTFOLIO' | 'APPLICATION' | 'SUBSYSTEM' | 'REPOSITORY';

// Source / code
export type CodeNodeType =
  | 'PROGRAM' | 'ENTRY_POINT' | 'SECTION' | 'PARAGRAPH'
  | 'PROCEDURE' | 'FUNCTION' | 'COPYBOOK' | 'INCLUDE'
  | 'MACRO' | 'SYMBOL' | 'DATA_ITEM' | 'RECORD' | 'CONDITION';

// Batch
export type BatchNodeType =
  | 'JOB' | 'JOB_STEP' | 'PROC' | 'PROC_STEP' | 'DD_STATEMENT'
  | 'SYMBOLIC_PARAMETER' | 'GDG_REFERENCE' | 'TEMP_DATASET' | 'UTILITY_EXECUTION';

// Data
export type DataNodeType =
  | 'DATASET' | 'VSAM_CLUSTER' | 'VSAM_PATH'
  | 'DB2_SUBSYSTEM' | 'DB2_DATABASE' | 'DB2_TABLESPACE'
  | 'DB2_TABLE' | 'DB2_VIEW' | 'DB2_COLUMN'
  | 'DB2_STORED_PROCEDURE' | 'DB2_CURSOR';

// Online / runtime
export type OnlineNodeType =
  | 'CICS_REGION' | 'CICS_TRANSACTION' | 'CICS_PROGRAM' | 'CICS_FILE' | 'CICS_QUEUE'
  | 'IMS_REGION' | 'IMS_TRANSACTION' | 'IMS_PROGRAM' | 'IMS_DATABASE' | 'IMS_SEGMENT';

// Resolution / quality
export type ResolutionNodeType =
  | 'EXTERNAL_MODULE' | 'MISSING_ARTIFACT' | 'UNRESOLVED_REFERENCE' | 'DYNAMIC_TARGET_SET';

export type KgNodeType =
  | PortfolioNodeType | CodeNodeType | BatchNodeType
  | DataNodeType | OnlineNodeType | ResolutionNodeType;

// ─── Relationship Types (spec §7) ────────────────────────────────────────────

// Program / code (§7.1)
export type CodeRelType =
  | 'CALLS_STATIC' | 'CALLS_DYNAMIC' | 'POSSIBLE_CALL_TARGET'
  | 'LINKS_TO' | 'XCTL_TO' | 'LOADS' | 'PERFORMS' | 'PERFORMS_THRU'
  | 'BRANCHES_TO' | 'USES_COPYBOOK' | 'INCLUDES' | 'USES_MACRO'
  | 'REFERENCES_SYMBOL' | 'DEFINES' | 'ASSIGNS' | 'MOVES_TO';

// Batch (§7.2)
export type BatchRelType =
  | 'CONTAINS_STEP' | 'USES_PROC' | 'EXPANDS_TO' | 'EXECUTES'
  | 'OVERRIDES' | 'DEFINES_DD' | 'INPUT_DD' | 'OUTPUT_DD'
  | 'MODIFIES_DD' | 'REFERENCES_DATASET' | 'RESOLVES_TO_DATASET' | 'GENERATES';

// Data access (§7.3)
export type DataRelType =
  | 'READS' | 'WRITES' | 'UPDATES' | 'INSERTS' | 'DELETES_FROM'
  | 'SELECTS_FROM' | 'MERGES_INTO' | 'OPENS_INPUT' | 'OPENS_OUTPUT'
  | 'OPENS_IO' | 'REWRITES' | 'STARTS_ON';

// Structural / lineage (§7.4)
export type LineageRelType =
  | 'FIELD_DERIVES_FROM' | 'FIELD_MAPS_TO' | 'RECORD_MAPS_TO'
  | 'COLUMN_MAPS_TO' | 'PRODUCES' | 'CONSUMES';

// Runtime / integration (§7.5)
export type RuntimeRelType =
  | 'MAPS_TRANSACTION_TO_PROGRAM' | 'ACCESSES_CICS_FILE'
  | 'READS_QUEUE' | 'WRITES_QUEUE' | 'SCHEDULES' | 'TRIGGERS';

export type KgRelType =
  | CodeRelType | BatchRelType | DataRelType | LineageRelType | RuntimeRelType;

// ─── Knowledge Graph Node ─────────────────────────────────────────────────────

export interface KgNode {
  id: string;                    // stable internal ID
  nodeType: KgNodeType;
  canonicalName: string;         // normalized identifier
  displayName: string;           // source-friendly identifier
  sourceArtifactId?: string;     // originating artifact
  location?: SourceLocation;     // source span
  namespace?: string;            // logical qualification
  technology: Technology;
  applicationId?: string;
  attributes?: Record<string, unknown>;
}

// ─── Knowledge Graph Edge ─────────────────────────────────────────────────────

export interface KgEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relType: KgRelType;
  confidence: Confidence;
  resolutionMethod?: string;
  evidenceIds: string[];
  runtimeContextId?: string;
  attributes?: Record<string, unknown>;
}

// ─── Evidence Record (spec §8) ───────────────────────────────────────────────

export interface EvidenceRecord {
  id: string;
  artifactId: string;
  startLine: number;
  startColumn?: number;
  endLine: number;
  endColumn?: number;
  sourceTextHash?: string;
  constructType: string;         // e.g. 'CALL_LITERAL', 'CALL_IDENTIFIER', 'SQL_SELECT'
  parserRule?: string;
  extractedValue?: string;       // raw source text (e.g. 'CUST100')
  normalizedValue?: string;      // canonical form (e.g. 'CUST100')
  sourceVersion?: string;
}

// ─── Source location ─────────────────────────────────────────────────────────

export interface SourceLocation {
  artifactId: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}

// ─── Technology ──────────────────────────────────────────────────────────────

export type Technology =
  | 'COBOL' | 'PLI' | 'ASM' | 'EASYTRIEVE' | 'JCL' | 'PROC'
  | 'DB2' | 'VSAM' | 'CICS' | 'IMS' | 'UNKNOWN';

// ─── Diagnostic / Scan Issue (spec §41) ──────────────────────────────────────

export type DiagnosticCode =
  | 'PARSE_SYNTAX_RECOVERED'
  | 'PARSE_UNSUPPORTED_DIALECT'
  | 'COPYBOOK_NOT_FOUND'
  | 'INCLUDE_CYCLE'
  | 'PROC_NOT_FOUND'
  | 'SYMBOLIC_UNRESOLVED'
  | 'PROGRAM_TARGET_NOT_FOUND'
  | 'DYNAMIC_CALL_UNRESOLVED'
  | 'DD_UNRESOLVED'
  | 'DATASET_UNRESOLVED'
  | 'SQL_DYNAMIC_UNRESOLVED'
  | 'CICS_RESOURCE_UNRESOLVED'
  | 'MACRO_NOT_FOUND'
  | 'ENCODING_ERROR';

export interface Diagnostic {
  code: DiagnosticCode;
  severity: 'error' | 'warning' | 'info';
  artifactId: string;
  startLine?: number;
  endLine?: number;
  message: string;
  relatedSymbol?: string;
  component: string;             // analyzer component that emitted this
}

// ─── Unresolved reference node ────────────────────────────────────────────────

export interface UnresolvedReference {
  id: string;
  sourceNodeId: string;
  referenceType: KgRelType;
  rawValue: string;              // the original symbol/name in source
  symbolId?: string;
  reasonCode: DiagnosticCode;
  candidateTargetIds: string[];
}
