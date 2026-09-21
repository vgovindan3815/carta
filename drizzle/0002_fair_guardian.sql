CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid,
	"program_name" text,
	"query" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"response" text,
	"tokens_used" integer DEFAULT 0,
	"provider" text,
	"model" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "app_brds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_id" uuid NOT NULL,
	"source_facts_hash" text NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_capability_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_id" uuid NOT NULL,
	"source_facts_hash" text NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_impacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_id" uuid NOT NULL,
	"source_facts_hash" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_mod_specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_id" uuid NOT NULL,
	"source_facts_hash" text NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"name" text NOT NULL,
	"member_program_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seed_method" text DEFAULT 'manual' NOT NULL,
	"seed_ref" text,
	"crosses_clusters" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_discrepancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"source_hash" text NOT NULL,
	"static_edge" jsonb NOT NULL,
	"llm_observation" text NOT NULL,
	"confidence" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'unreviewed' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"source_hash" text NOT NULL,
	"entry_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"business_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decision_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data_transformations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exception_paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data_objects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"out_of_scope_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"flows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"observations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"injection_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extracted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"commit_sha" text,
	"source_text" text NOT NULL,
	"source_hash" text NOT NULL,
	"loc" integer DEFAULT 0 NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_completeness" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_job_id" uuid NOT NULL,
	"repo_id" uuid NOT NULL,
	"unresolved_copy_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"missing_jcl_dds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"binary_only_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "copybooks" ADD COLUMN "kind" text DEFAULT 'business-data' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_brds" ADD CONSTRAINT "app_brds_scope_id_app_scopes_id_fk" FOREIGN KEY ("scope_id") REFERENCES "public"."app_scopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_capability_maps" ADD CONSTRAINT "app_capability_maps_scope_id_app_scopes_id_fk" FOREIGN KEY ("scope_id") REFERENCES "public"."app_scopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_impacts" ADD CONSTRAINT "app_impacts_scope_id_app_scopes_id_fk" FOREIGN KEY ("scope_id") REFERENCES "public"."app_scopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_mod_specs" ADD CONSTRAINT "app_mod_specs_scope_id_app_scopes_id_fk" FOREIGN KEY ("scope_id") REFERENCES "public"."app_scopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_scopes" ADD CONSTRAINT "app_scopes_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_discrepancies" ADD CONSTRAINT "graph_discrepancies_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_discrepancies" ADD CONSTRAINT "graph_discrepancies_job_id_analysis_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."analysis_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_facts" ADD CONSTRAINT "module_facts_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_facts" ADD CONSTRAINT "module_facts_job_id_analysis_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."analysis_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_sources" ADD CONSTRAINT "program_sources_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_completeness" ADD CONSTRAINT "scan_completeness_scan_job_id_scan_jobs_id_fk" FOREIGN KEY ("scan_job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_completeness" ADD CONSTRAINT "scan_completeness_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;