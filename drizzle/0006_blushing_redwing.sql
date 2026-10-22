CREATE TABLE "analysis_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"scan_id" uuid,
	"seq" integer NOT NULL,
	"analyzer_versions" jsonb,
	"graph_schema_version" text DEFAULT '1.0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_manifests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"target_id" text NOT NULL,
	"manifest_data" jsonb NOT NULL,
	"fact_keys" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"node_key" text,
	"edge_src_key" text,
	"edge_dst_key" text,
	"edge_rel_type" text,
	"original_value" jsonb,
	"corrected_value" jsonb,
	"reviewer" text NOT NULL,
	"reason" text,
	"snapshot_scope" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"section_key" text NOT NULL,
	"section_title" text NOT NULL,
	"content" text NOT NULL,
	"fact_hash" text,
	"depends_on" jsonb,
	"staleness" text DEFAULT 'current' NOT NULL,
	"generated_by" text,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"scan_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"chain_ids" jsonb,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"run_id" uuid,
	"kind" text NOT NULL,
	"target_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"node_or_edge_id" uuid NOT NULL,
	"node_or_edge_kind" text NOT NULL,
	"analyzer_id" text NOT NULL,
	"analyzer_version" text NOT NULL,
	"source_file_id" uuid,
	"line_start" integer,
	"line_end" integer,
	"construct" text,
	"confidence" integer DEFAULT 100 NOT NULL,
	"attributes" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kg_edge_presence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edge_id" uuid NOT NULL,
	"analysis_run_id" uuid NOT NULL,
	"valid_from_seq" integer NOT NULL,
	"valid_to_seq" integer
);
--> statement-breakpoint
CREATE TABLE "kg_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"src_node_id" uuid NOT NULL,
	"dst_node_id" uuid NOT NULL,
	"rel_type" text NOT NULL,
	"discriminator" text DEFAULT 'default' NOT NULL,
	"attributes" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kg_node_presence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"analysis_run_id" uuid NOT NULL,
	"valid_from_seq" integer NOT NULL,
	"valid_to_seq" integer
);
--> statement-breakpoint
CREATE TABLE "kg_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"node_type" text NOT NULL,
	"canonical_key" text NOT NULL,
	"attributes" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_node_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"alias_kind" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_scan_id_p1_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."p1_scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_manifests" ADD CONSTRAINT "context_manifests_run_id_documentation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."documentation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sections" ADD CONSTRAINT "document_sections_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentation_runs" ADD CONSTRAINT "documentation_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentation_runs" ADD CONSTRAINT "documentation_runs_scan_id_p1_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."p1_scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_run_id_documentation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."documentation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_source_file_id_source_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."source_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kg_edge_presence" ADD CONSTRAINT "kg_edge_presence_edge_id_kg_edges_id_fk" FOREIGN KEY ("edge_id") REFERENCES "public"."kg_edges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kg_edges" ADD CONSTRAINT "kg_edges_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kg_edges" ADD CONSTRAINT "kg_edges_src_node_id_kg_nodes_id_fk" FOREIGN KEY ("src_node_id") REFERENCES "public"."kg_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kg_edges" ADD CONSTRAINT "kg_edges_dst_node_id_kg_nodes_id_fk" FOREIGN KEY ("dst_node_id") REFERENCES "public"."kg_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kg_node_presence" ADD CONSTRAINT "kg_node_presence_node_id_kg_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."kg_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kg_nodes" ADD CONSTRAINT "kg_nodes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_aliases" ADD CONSTRAINT "program_aliases_entity_node_id_kg_nodes_id_fk" FOREIGN KEY ("entity_node_id") REFERENCES "public"."kg_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kg_edges_unique_idx" ON "kg_edges" USING btree ("project_id","src_node_id","dst_node_id","rel_type","discriminator");--> statement-breakpoint
CREATE UNIQUE INDEX "kg_nodes_identity_idx" ON "kg_nodes" USING btree ("project_id","node_type","canonical_key");