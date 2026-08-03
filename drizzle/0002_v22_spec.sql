-- v2.2 spec migration: source storage, moduleFacts, graph discrepancies,
-- scan completeness, Tier 2 tables, copybook kind

-- Source storage
CREATE TABLE "program_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "program_id" uuid NOT NULL,
  "commit_sha" text,
  "source_text" text NOT NULL,
  "source_hash" text NOT NULL,
  "loc" integer NOT NULL DEFAULT 0,
  "captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "program_sources" ADD CONSTRAINT "program_sources_program_id_programs_id_fk"
  FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;

-- Module facts
CREATE TABLE "module_facts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "program_id" uuid NOT NULL,
  "job_id" uuid NOT NULL,
  "source_hash" text NOT NULL,
  "entry_points" jsonb NOT NULL DEFAULT '[]',
  "business_rules" jsonb NOT NULL DEFAULT '[]',
  "decision_points" jsonb NOT NULL DEFAULT '[]',
  "data_transformations" jsonb NOT NULL DEFAULT '[]',
  "exception_paths" jsonb NOT NULL DEFAULT '[]',
  "data_objects" jsonb NOT NULL DEFAULT '[]',
  "out_of_scope_refs" jsonb NOT NULL DEFAULT '[]',
  "flows" jsonb NOT NULL DEFAULT '[]',
  "observations" jsonb NOT NULL DEFAULT '[]',
  "injection_flags" jsonb NOT NULL DEFAULT '[]',
  "extracted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "module_facts" ADD CONSTRAINT "module_facts_program_id_programs_id_fk"
  FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "module_facts" ADD CONSTRAINT "module_facts_job_id_analysis_jobs_id_fk"
  FOREIGN KEY ("job_id") REFERENCES "public"."analysis_jobs"("id") ON DELETE cascade ON UPDATE no action;

-- Graph discrepancies
CREATE TABLE "graph_discrepancies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "program_id" uuid NOT NULL,
  "job_id" uuid NOT NULL,
  "source_hash" text NOT NULL,
  "static_edge" jsonb NOT NULL,
  "llm_observation" text NOT NULL,
  "confidence" text NOT NULL DEFAULT 'medium',
  "status" text NOT NULL DEFAULT 'unreviewed',
  "reviewed_by" text,
  "reviewed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "graph_discrepancies" ADD CONSTRAINT "graph_discrepancies_program_id_programs_id_fk"
  FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "graph_discrepancies" ADD CONSTRAINT "graph_discrepancies_job_id_analysis_jobs_id_fk"
  FOREIGN KEY ("job_id") REFERENCES "public"."analysis_jobs"("id") ON DELETE cascade ON UPDATE no action;

-- Scan completeness
CREATE TABLE "scan_completeness" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scan_job_id" uuid NOT NULL,
  "repo_id" uuid NOT NULL,
  "unresolved_copy_refs" jsonb NOT NULL DEFAULT '[]',
  "missing_jcl_dds" jsonb NOT NULL DEFAULT '[]',
  "binary_only_refs" jsonb NOT NULL DEFAULT '[]',
  "captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scan_completeness" ADD CONSTRAINT "scan_completeness_scan_job_id_scan_jobs_id_fk"
  FOREIGN KEY ("scan_job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scan_completeness" ADD CONSTRAINT "scan_completeness_repo_id_repos_id_fk"
  FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;

-- App scopes
CREATE TABLE "app_scopes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "repo_id" uuid NOT NULL,
  "name" text NOT NULL,
  "member_program_ids" jsonb NOT NULL DEFAULT '[]',
  "seed_method" text NOT NULL DEFAULT 'manual',
  "seed_ref" text,
  "crosses_clusters" boolean NOT NULL DEFAULT false,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_scopes" ADD CONSTRAINT "app_scopes_repo_id_repos_id_fk"
  FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;

-- App capability maps
CREATE TABLE "app_capability_maps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope_id" uuid NOT NULL,
  "source_facts_hash" text NOT NULL,
  "capabilities" jsonb NOT NULL DEFAULT '[]',
  "generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_capability_maps" ADD CONSTRAINT "app_capability_maps_scope_id_app_scopes_id_fk"
  FOREIGN KEY ("scope_id") REFERENCES "public"."app_scopes"("id") ON DELETE cascade ON UPDATE no action;

-- App BRDs
CREATE TABLE "app_brds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope_id" uuid NOT NULL,
  "source_facts_hash" text NOT NULL,
  "sections" jsonb NOT NULL DEFAULT '[]',
  "generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_brds" ADD CONSTRAINT "app_brds_scope_id_app_scopes_id_fk"
  FOREIGN KEY ("scope_id") REFERENCES "public"."app_scopes"("id") ON DELETE cascade ON UPDATE no action;

-- App mod specs
CREATE TABLE "app_mod_specs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope_id" uuid NOT NULL,
  "source_facts_hash" text NOT NULL,
  "sections" jsonb NOT NULL DEFAULT '[]',
  "generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_mod_specs" ADD CONSTRAINT "app_mod_specs_scope_id_app_scopes_id_fk"
  FOREIGN KEY ("scope_id") REFERENCES "public"."app_scopes"("id") ON DELETE cascade ON UPDATE no action;

-- App impacts
CREATE TABLE "app_impacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope_id" uuid NOT NULL,
  "source_facts_hash" text NOT NULL,
  "items" jsonb NOT NULL DEFAULT '[]',
  "generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_impacts" ADD CONSTRAINT "app_impacts_scope_id_app_scopes_id_fk"
  FOREIGN KEY ("scope_id") REFERENCES "public"."app_scopes"("id") ON DELETE cascade ON UPDATE no action;

-- Add kind column to copybooks
ALTER TABLE "copybooks" ADD COLUMN "kind" text NOT NULL DEFAULT 'business-data';
