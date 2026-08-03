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
