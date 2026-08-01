CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."validation_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "analysis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"phase" text,
	"progress_pct" real DEFAULT 0,
	"log" jsonb DEFAULT '[]'::jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error" text,
	"tokens_used" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "biz_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"sections" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_impacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"items" jsonb NOT NULL,
	"coverage_pct" real NOT NULL,
	"coverage_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copybooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"fields" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dep_graphs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"nodes" jsonb NOT NULL,
	"edges" jsonb NOT NULL,
	"coverage_pct" real DEFAULT 100 NOT NULL,
	"c_layout_nodes" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_glossary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"pattern" text NOT NULL,
	"description" text NOT NULL,
	"examples" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mod_specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"sections" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"name" text NOT NULL,
	"language" text NOT NULL,
	"loc" integer DEFAULT 0 NOT NULL,
	"domain" text,
	"desc" text,
	"file_path" text NOT NULL,
	"last_commit_sha" text,
	"last_analyzed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_name" text DEFAULT 'Default Project' NOT NULL,
	"github_url" text NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"branch" text DEFAULT 'main' NOT NULL,
	"pat_encrypted" text,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"artifact_type" text NOT NULL,
	"reviewer" text NOT NULL,
	"reviewed_at" timestamp DEFAULT now(),
	"notes" text,
	"status" "validation_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biz_rules" ADD CONSTRAINT "biz_rules_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biz_rules" ADD CONSTRAINT "biz_rules_job_id_analysis_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."analysis_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_impacts" ADD CONSTRAINT "change_impacts_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_impacts" ADD CONSTRAINT "change_impacts_job_id_analysis_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."analysis_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copybooks" ADD CONSTRAINT "copybooks_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dep_graphs" ADD CONSTRAINT "dep_graphs_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dep_graphs" ADD CONSTRAINT "dep_graphs_job_id_analysis_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."analysis_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_glossary" ADD CONSTRAINT "domain_glossary_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mod_specs" ADD CONSTRAINT "mod_specs_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mod_specs" ADD CONSTRAINT "mod_specs_job_id_analysis_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."analysis_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validations" ADD CONSTRAINT "validations_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;