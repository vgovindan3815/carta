import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  uuid,
  real,
  boolean,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  GraphNode,
  GraphEdge,
  BusinessRulesSection,
  ChangeImpactItem,
  SpecSection,
  CopybookField,
  RuleCard,
  DataObject,
  PersonaFlow,
  InjectionFlag,
  AppCapability,
  GraphDiscrepancy,
  InternalFlow,
} from '../parser/types';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const jobStatusEnum = pgEnum('job_status', [
  'pending',
  'running',
  'completed',
  'failed',
]);

export const validationStatusEnum = pgEnum('validation_status', [
  'pending',
  'approved',
  'rejected',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** GitHub repositories that MAVEN/CARTA monitors. */
export const repos = pgTable('repos', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectName: text('project_name').notNull().default('Default Project'),
  githubUrl: text('github_url').notNull(),
  owner: text('owner').notNull(),
  repo: text('repo').notNull(),
  branch: text('branch').notNull().default('main'),
  patEncrypted: text('pat_encrypted'),
  lastSyncedAt: timestamp('last_synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  projectId: uuid('project_id'), // FK to projects — added in 0007 backfill migration
});

/** Individual COBOL/HLASM programs discovered in a repo. */
export const programs = pgTable('programs', {
  id: uuid('id').defaultRandom().primaryKey(),
  repoId: uuid('repo_id')
    .references(() => repos.id)
    .notNull(),
  name: text('name').notNull(),
  language: text('language').notNull(),
  loc: integer('loc').notNull().default(0),
  domain: text('domain'),
  desc: text('desc'),
  filePath: text('file_path').notNull(),
  lastCommitSha: text('last_commit_sha'),
  lastAnalyzedAt: timestamp('last_analyzed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  projectId: uuid('project_id'), // FK to projects — added in 0007 backfill migration
});

/** A single end-to-end analysis run for a program. */
export const analysisJobs = pgTable('analysis_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  programId: uuid('program_id')
    .references(() => programs.id)
    .notNull(),
  status: jobStatusEnum('status').notNull().default('pending'),
  phase: text('phase'),
  progressPct: real('progress_pct').default(0),
  log: jsonb('log')
    .$type<{ lv: string; t: string; ts: number }[]>()
    .default([]),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  error: text('error'),
  tokensUsed: integer('tokens_used').default(0),
});

/** Dependency graph produced by the deterministic parser. */
export const depGraphs = pgTable('dep_graphs', {
  id: uuid('id').defaultRandom().primaryKey(),
  programId: uuid('program_id')
    .references(() => programs.id)
    .notNull(),
  jobId: uuid('job_id')
    .references(() => analysisJobs.id)
    .notNull(),
  nodes: jsonb('nodes').notNull().$type<GraphNode[]>(),
  edges: jsonb('edges').notNull().$type<GraphEdge[]>(),
  coveragePct: real('coverage_pct').notNull().default(100),
  cLayoutNodes: jsonb('c_layout_nodes').$type<GraphNode[]>(),
  internalFlow: jsonb('internal_flow').$type<InternalFlow>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** Business rules extracted by LLM chain 1. */
export const bizRules = pgTable('biz_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  programId: uuid('program_id')
    .references(() => programs.id)
    .notNull(),
  jobId: uuid('job_id')
    .references(() => analysisJobs.id)
    .notNull(),
  sections: jsonb('sections').notNull().$type<BusinessRulesSection[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** Change impact analysis produced by LLM chain 2. */
export const changeImpacts = pgTable('change_impacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  programId: uuid('program_id')
    .references(() => programs.id)
    .notNull(),
  jobId: uuid('job_id')
    .references(() => analysisJobs.id)
    .notNull(),
  items: jsonb('items').notNull().$type<ChangeImpactItem[]>(),
  coveragePct: real('coverage_pct').notNull(),
  coverageNote: text('coverage_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** Modernization spec produced by LLM chain 3. */
export const modSpecs = pgTable('mod_specs', {
  id: uuid('id').defaultRandom().primaryKey(),
  programId: uuid('program_id')
    .references(() => programs.id)
    .notNull(),
  jobId: uuid('job_id')
    .references(() => analysisJobs.id)
    .notNull(),
  sections: jsonb('sections').notNull().$type<SpecSection[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** Global app settings — key/value store for LLM provider config etc. */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/** Copybook (.cpy) definitions — field registry per repo. */
export const copybooks = pgTable('copybooks', {
  id: uuid('id').defaultRandom().primaryKey(),
  repoId: uuid('repo_id').references(() => repos.id).notNull(),
  name: text('name').notNull(),
  source: text('source').notNull(),
  fields: jsonb('fields').notNull().$type<CopybookField[]>(),
  /** 'business-data' | 'utility' | 'system' — used to exclude utility copybooks from capability clustering */
  kind: text('kind').notNull().default('business-data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** Domain glossary — field-pattern to plain-English description mapping per repo. */
export const domainGlossary = pgTable('domain_glossary', {
  id: uuid('id').defaultRandom().primaryKey(),
  repoId: uuid('repo_id').references(() => repos.id).notNull(),
  pattern: text('pattern').notNull(),
  description: text('description').notNull(),
  examples: jsonb('examples').$type<string[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** Repository scan jobs — tracks async background scanning of GitHub repos. */
export const scanJobs = pgTable('scan_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  repoId: uuid('repo_id').references(() => repos.id).notNull(),
  status: text('status').notNull().default('pending'), // pending | running | completed | failed
  scannedFiles: integer('scanned_files').default(0),
  totalFiles: integer('total_files').default(0),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// ---------------------------------------------------------------------------
// v2.2 — Source storage (§2, program_sources)
// ---------------------------------------------------------------------------

/** Stores the raw source text + hash for each program (enables click-to-source + staleness detection). */
export const programSources = pgTable('program_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  programId: uuid('program_id').references(() => programs.id).notNull(),
  commitSha: text('commit_sha'),
  sourceText: text('source_text').notNull(),
  sourceHash: text('source_hash').notNull(), // sha256 of sourceText
  loc: integer('loc').notNull().default(0),
  capturedAt: timestamp('captured_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// v2.2 — Module facts (§2, moduleFacts table — Chain 1 output)
// ---------------------------------------------------------------------------

/** Structured extraction facts: Rule Cards, DataObjects, flows, observations, injectionFlags. */
export const moduleFacts = pgTable('module_facts', {
  id: uuid('id').defaultRandom().primaryKey(),
  programId: uuid('program_id').references(() => programs.id).notNull(),
  jobId: uuid('job_id').references(() => analysisJobs.id).notNull(),
  sourceHash: text('source_hash').notNull(),
  entryPoints: jsonb('entry_points').notNull().$type<string[]>().default([]),
  businessRules: jsonb('business_rules').notNull().$type<RuleCard[]>().default([]),
  decisionPoints: jsonb('decision_points').notNull().$type<unknown[]>().default([]),
  dataTransformations: jsonb('data_transformations').notNull().$type<unknown[]>().default([]),
  exceptionPaths: jsonb('exception_paths').notNull().$type<unknown[]>().default([]),
  dataObjects: jsonb('data_objects').notNull().$type<DataObject[]>().default([]),
  outOfScopeRefs: jsonb('out_of_scope_refs').notNull().$type<unknown[]>().default([]),
  flows: jsonb('flows').notNull().$type<PersonaFlow[]>().default([]),
  observations: jsonb('observations').notNull().$type<string[]>().default([]),
  injectionFlags: jsonb('injection_flags').notNull().$type<InjectionFlag[]>().default([]),
  extractedAt: timestamp('extracted_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// v2.2 — Graph discrepancies (§3)
// ---------------------------------------------------------------------------

/** Static parser vs LLM disagreements — static graph is authoritative until human confirms. */
export const graphDiscrepancies = pgTable('graph_discrepancies', {
  id: uuid('id').defaultRandom().primaryKey(),
  programId: uuid('program_id').references(() => programs.id).notNull(),
  jobId: uuid('job_id').references(() => analysisJobs.id).notNull(),
  sourceHash: text('source_hash').notNull(),
  staticEdge: jsonb('static_edge').notNull().$type<GraphDiscrepancy['staticEdge']>(),
  llmObservation: text('llm_observation').notNull(),
  confidence: text('confidence').notNull().default('medium'),
  status: text('status').notNull().default('unreviewed'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// v2.2 — Scan completeness report (§2.5)
// ---------------------------------------------------------------------------

/** Source completeness report per scan job — unresolved COPY refs, missing JCL DDs. */
export const scanCompleteness = pgTable('scan_completeness', {
  id: uuid('id').defaultRandom().primaryKey(),
  scanJobId: uuid('scan_job_id').references(() => scanJobs.id).notNull(),
  repoId: uuid('repo_id').references(() => repos.id).notNull(),
  unresolvedCopyRefs: jsonb('unresolved_copy_refs').notNull().$type<Array<{ program: string; copybook: string; line: number }>>().default([]),
  missingJclDDs: jsonb('missing_jcl_dds').notNull().$type<Array<{ job: string; dd: string; dsn: string }>>().default([]),
  binaryOnlyRefs: jsonb('binary_only_refs').notNull().$type<Array<{ program: string; note: string }>>().default([]),
  capturedAt: timestamp('captured_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// v2.2 — Tier 2 tables (§1, §5.1)
// ---------------------------------------------------------------------------

/** User-defined modernization scope — a named set of programs for Tier 2 analysis. */
export const appScopes = pgTable('app_scopes', {
  id: uuid('id').defaultRandom().primaryKey(),
  repoId: uuid('repo_id').references(() => repos.id).notNull(),
  name: text('name').notNull(),
  memberProgramIds: jsonb('member_program_ids').notNull().$type<string[]>().default([]),
  /** 'cluster' | 'job-chain' | 'manual' */
  seedMethod: text('seed_method').notNull().default('manual'),
  seedRef: text('seed_ref'),
  crossesClusters: boolean('crosses_clusters').notNull().default(false),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** Capability map produced by Chain 5 — one row per scope generation. */
export const appCapabilityMaps = pgTable('app_capability_maps', {
  id: uuid('id').defaultRandom().primaryKey(),
  scopeId: uuid('scope_id').references(() => appScopes.id).notNull(),
  sourceFactsHash: text('source_facts_hash').notNull(),
  capabilities: jsonb('capabilities').notNull().$type<AppCapability[]>().default([]),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
});

/** App-level BRD produced by Chain 7. */
export const appBrds = pgTable('app_brds', {
  id: uuid('id').defaultRandom().primaryKey(),
  scopeId: uuid('scope_id').references(() => appScopes.id).notNull(),
  sourceFactsHash: text('source_facts_hash').notNull(),
  sections: jsonb('sections').notNull().$type<SpecSection[]>().default([]),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
});

/** App-level modernization spec produced by Chain 8. */
export const appModSpecs = pgTable('app_mod_specs', {
  id: uuid('id').defaultRandom().primaryKey(),
  scopeId: uuid('scope_id').references(() => appScopes.id).notNull(),
  sourceFactsHash: text('source_facts_hash').notNull(),
  sections: jsonb('sections').notNull().$type<SpecSection[]>().default([]),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
});

/** App-level impact (cross-module blast radius) produced by Chain 6. */
export const appImpacts = pgTable('app_impacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  scopeId: uuid('scope_id').references(() => appScopes.id).notNull(),
  sourceFactsHash: text('source_facts_hash').notNull(),
  items: jsonb('items').notNull().$type<ChangeImpactItem[]>().default([]),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Validations
// ---------------------------------------------------------------------------

/** Human review / validation records for any generated artifact. */
export const validations = pgTable('validations', {
  id: uuid('id').defaultRandom().primaryKey(),
  programId: uuid('program_id')
    .references(() => programs.id)
    .notNull(),
  /** 'dependency' | 'business_rules' | 'change_impact' | 'spec' */
  artifactType: text('artifact_type').notNull(),
  reviewer: text('reviewer').notNull(),
  reviewedAt: timestamp('reviewed_at').defaultNow(),
  notes: text('notes'),
  status: validationStatusEnum('status').notNull().default('pending'),
});

// ---------------------------------------------------------------------------
// Audit events — tracks all destructive admin actions
// ---------------------------------------------------------------------------

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  targetName: text('target_name'),
  performedBy: text('performed_by').notNull().default('system'),
  reason: text('reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Agent runs — agentic chat session records
// ---------------------------------------------------------------------------

/** Records of MAVEN Agent chat sessions and autonomous analysis runs. */
export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  repoId: uuid('repo_id').references(() => repos.id),
  programName: text('program_name'),           // null = portfolio-level
  query: text('query').notNull(),
  status: text('status').notNull().default('running'), // running | completed | failed
  messages: jsonb('messages').$type<object[]>().notNull().default([]),
  toolCalls: jsonb('tool_calls').$type<object[]>().notNull().default([]),
  response: text('response'),                  // final assistant text
  tokensUsed: integer('tokens_used').default(0),
  provider: text('provider'),
  model: text('model'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// ---------------------------------------------------------------------------
// Phase 1 — Project model (behind FF_PROJECTS)
// ---------------------------------------------------------------------------

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  createdBy: text('created_by').notNull().default('system'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sourceConnections = pgTable('source_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  kind: text('kind').notNull(), // 'github' | 'upload'
  owner: text('owner'),
  repo: text('repo'),
  branch: text('branch'),
  patEncryptedRef: text('pat_encrypted_ref'),
  uploadLabel: text('upload_label'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const sourceSnapshots = pgTable('source_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  sourceConnectionId: uuid('source_connection_id').references(() => sourceConnections.id),
  commitSha: text('commit_sha'),
  acquiredAt: timestamp('acquired_at').notNull().defaultNow(),
  fileCount: integer('file_count').notNull().default(0),
});

export const sourceFiles = pgTable('source_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  snapshotId: uuid('snapshot_id').notNull().references(() => sourceSnapshots.id),
  path: text('path').notNull(),
  sha256: text('sha256'),
  language: text('language'),
  languageConfidence: integer('language_confidence'),
  loc: integer('loc'),
  classification: text('classification'), // 'program' | 'copybook' | 'jcl' | 'proc' | 'other'
  analysisStatus: text('analysis_status').notNull().default('pending'),
  parserId: text('parser_id'),
  parserVersion: text('parser_version'),
  moduleId: uuid('module_id'),
  attributes: jsonb('attributes').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const p1Modules = pgTable('p1_modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  ruleSource: text('rule_source').notNull().default('auto'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const moduleMemberships = pgTable('module_memberships', {
  moduleId: uuid('module_id').notNull().references(() => p1Modules.id),
  sourceFileId: uuid('source_file_id').notNull().references(() => sourceFiles.id),
  assignedBy: text('assigned_by').notNull().default('auto'),
});

export const p1Scans = pgTable('p1_scans', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  snapshotId: uuid('snapshot_id').references(() => sourceSnapshots.id),
  status: text('status').notNull().default('queued'),
  headlineStatus: text('headline_status'),
  inngestRunId: text('inngest_run_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const scanStages = pgTable('scan_stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  scanId: uuid('scan_id').notNull().references(() => p1Scans.id),
  stageName: text('stage_name').notNull(),
  status: text('status').notNull().default('pending'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  itemsProcessed: integer('items_processed').notNull().default(0),
  itemsFailed: integer('items_failed').notNull().default(0),
  warningCount: integer('warning_count').notNull().default(0),
  errorCode: text('error_code'),
  message: text('message'),
  attemptCount: integer('attempt_count').notNull().default(0),
});

export const scanIssues = pgTable('scan_issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  scanId: uuid('scan_id').notNull().references(() => p1Scans.id),
  sourceFileId: uuid('source_file_id').references(() => sourceFiles.id),
  issueKind: text('issue_kind').notNull(),
  severity: text('severity').notNull().default('warning'),
  message: text('message').notNull(),
  details: jsonb('details').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Phase 2 — Knowledge Graph (behind FF_KNOWLEDGE)
// ---------------------------------------------------------------------------

export const kgNodes = pgTable('kg_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  nodeType: text('node_type').notNull(),
  canonicalKey: text('canonical_key').notNull(),
  attributes: jsonb('attributes').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  uniqueIdentity: uniqueIndex('kg_nodes_identity_idx').on(t.projectId, t.nodeType, t.canonicalKey),
}));

export const kgNodePresence = pgTable('kg_node_presence', {
  id: uuid('id').primaryKey().defaultRandom(),
  nodeId: uuid('node_id').notNull().references(() => kgNodes.id),
  analysisRunId: uuid('analysis_run_id').notNull(),
  validFromSeq: integer('valid_from_seq').notNull(),
  validToSeq: integer('valid_to_seq'),
});

export const kgEdges = pgTable('kg_edges', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  srcNodeId: uuid('src_node_id').notNull().references(() => kgNodes.id),
  dstNodeId: uuid('dst_node_id').notNull().references(() => kgNodes.id),
  relType: text('rel_type').notNull(),
  discriminator: text('discriminator').notNull().default('default'),
  attributes: jsonb('attributes').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  uniqueEdge: uniqueIndex('kg_edges_unique_idx').on(t.projectId, t.srcNodeId, t.dstNodeId, t.relType, t.discriminator),
}));

export const kgEdgePresence = pgTable('kg_edge_presence', {
  id: uuid('id').primaryKey().defaultRandom(),
  edgeId: uuid('edge_id').notNull().references(() => kgEdges.id),
  analysisRunId: uuid('analysis_run_id').notNull(),
  validFromSeq: integer('valid_from_seq').notNull(),
  validToSeq: integer('valid_to_seq'),
});

export const evidenceRecords = pgTable('evidence_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  nodeOrEdgeId: uuid('node_or_edge_id').notNull(),
  nodeOrEdgeKind: text('node_or_edge_kind').notNull(),
  analyzerId: text('analyzer_id').notNull(),
  analyzerVersion: text('analyzer_version').notNull(),
  sourceFileId: uuid('source_file_id').references(() => sourceFiles.id),
  lineStart: integer('line_start'),
  lineEnd: integer('line_end'),
  construct: text('construct'),
  confidence: integer('confidence').notNull().default(100),
  attributes: jsonb('attributes').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const programAliases = pgTable('program_aliases', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityNodeId: uuid('entity_node_id').notNull().references(() => kgNodes.id),
  alias: text('alias').notNull(),
  aliasKind: text('alias_kind').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const analysisRuns = pgTable('analysis_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  scanId: uuid('scan_id').references(() => p1Scans.id),
  seq: integer('seq').notNull(),
  analyzerVersions: jsonb('analyzer_versions').$type<Record<string, string>>(),
  graphSchemaVersion: text('graph_schema_version').notNull().default('1.0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const corrections = pgTable('corrections', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  nodeKey: text('node_key'),
  edgeSrcKey: text('edge_src_key'),
  edgeDstKey: text('edge_dst_key'),
  edgeRelType: text('edge_rel_type'),
  originalValue: jsonb('original_value').$type<Record<string, unknown>>(),
  correctedValue: jsonb('corrected_value').$type<Record<string, unknown>>(),
  reviewer: text('reviewer').notNull(),
  reason: text('reason'),
  snapshotScope: boolean('snapshot_scope').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ── Phase 3: Documentation Workspace ─────────────────────────────────────

export const documentationRuns = pgTable('documentation_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  scanId: uuid('scan_id').references(() => p1Scans.id),
  status: text('status').notNull().default('queued'),
  chainIds: jsonb('chain_ids').$type<string[]>(),
  tokensUsed: integer('tokens_used').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  runId: uuid('run_id').references(() => documentationRuns.id),
  kind: text('kind').notNull(),
  targetId: text('target_id').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const documentSections = pgTable('document_sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id),
  sectionKey: text('section_key').notNull(),
  sectionTitle: text('section_title').notNull(),
  content: text('content').notNull(),
  factHash: text('fact_hash'),
  dependsOn: jsonb('depends_on').$type<string[]>(),
  staleness: text('staleness').notNull().default('current'),
  generatedBy: text('generated_by'),
  tokensUsed: integer('tokens_used').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const contextManifests = pgTable('context_manifests', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => documentationRuns.id),
  targetId: text('target_id').notNull(),
  manifestData: jsonb('manifest_data').$type<Record<string, unknown>>().notNull(),
  factKeys: jsonb('fact_keys').$type<string[]>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
