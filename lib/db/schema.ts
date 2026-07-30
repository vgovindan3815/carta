import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  uuid,
  real,
  pgEnum,
} from 'drizzle-orm/pg-core';
import type {
  GraphNode,
  GraphEdge,
  BusinessRulesSection,
  ChangeImpactItem,
  SpecSection,
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
