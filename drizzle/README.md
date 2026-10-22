# Drizzle Migration History

## Applied migrations (linear history)

| idx | File | Applied | Notes |
|---|---|---|---|
| 0 | `0000_goofy_iron_lad.sql` | ✅ | Base tables: repos, programs, analysis_jobs, dep_graphs, biz_rules, change_impacts, mod_specs, settings, copybooks, domain_glossary, validations |
| 1 | `0001_moaning_chronomancer.sql` | ✅ | scan_jobs |
| 2 | `0002_fair_guardian.sql` | ✅ | v2.2 tables: program_sources, module_facts, graph_discrepancies, scan_completeness, app_scopes, app_capability_maps, app_brds, app_mod_specs, app_impacts, agent_runs; adds `kind` to copybooks |
| 3 | `0003_internal_flow.sql` | ✅ | Adds `internal_flow` JSONB column to `dep_graphs` |
| 4 | `0004_audit_events.sql` | ✅ | Creates `audit_events` table (confirmed applied 2026-10-21) |
| 5 | `0005_outstanding_penance.sql` | ⚠️ **Apply manually — see below** | Phase 1 project model: projects, source_connections, source_snapshots, source_files, p1_modules, module_memberships, p1_scans, scan_stages, scan_issues |
| 6 | `0006_blushing_redwing.sql` | ⚠️ **Apply manually** | Phase 2+3 tables: kg_nodes, kg_edges, kg_node_presence, kg_edge_presence, evidence_records, program_aliases, analysis_runs, corrections, documentation_runs, documents, document_sections, context_manifests |
| 7 | `0007_backfill_project_id.sql` | ⚠️ **Apply manually — step by step** | Data migration: adds project_id FK to repos+programs; creates synthetic projects for existing repos. Run statements 1-2 first, verify, then uncomment and run UPDATE statements 4-5. |

## Archived (do not apply)

| File | Reason |
|---|---|
| `archive/0002_v22_spec.SUPERSEDED.sql` | Superseded by `0002_fair_guardian.sql`. Contains identical tables with slightly different FK constraints (CASCADE vs NO ACTION). Running it would fail with "table already exists". |

## How to apply a pending migration to Neon

Neon free tier has no branching. Before applying any migration to production:

1. **Take a backup** via the Neon console → your project → Restore tab → create a restore point.
2. Open the **Neon SQL editor** for your database.
3. Paste and run the contents of the migration SQL file.
4. Verify: `SELECT * FROM __drizzle_migrations ORDER BY created_at;`

**Pending right now — `0005_outstanding_penance.sql`**

The full file is at `drizzle/0005_outstanding_penance.sql`. Run only the new CREATE TABLE / ALTER statements.

⚠️ **Skip these lines** — already applied to Neon:
- `CREATE TABLE "audit_events" ...` — applied 2026-10-21
- `ALTER TABLE "dep_graphs" ADD COLUMN "internal_flow" jsonb` — applied previously

**Safe to run (new Phase 1 tables):**
```sql
CREATE TABLE "module_memberships" (
  "module_id" uuid NOT NULL,
  "source_file_id" uuid NOT NULL,
  "assigned_by" text DEFAULT 'auto' NOT NULL
);

CREATE TABLE "p1_modules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "name" text NOT NULL,
  "rule_source" text DEFAULT 'auto' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "p1_scans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "snapshot_id" uuid,
  "status" text DEFAULT 'queued' NOT NULL,
  "headline_status" text,
  "inngest_run_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);

CREATE TABLE "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_by" text DEFAULT 'system' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "scan_issues" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scan_id" uuid NOT NULL,
  "source_file_id" uuid,
  "issue_kind" text NOT NULL,
  "severity" text DEFAULT 'warning' NOT NULL,
  "message" text NOT NULL,
  "details" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "scan_stages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scan_id" uuid NOT NULL,
  "stage_name" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "started_at" timestamp,
  "completed_at" timestamp,
  "items_processed" integer DEFAULT 0 NOT NULL,
  "items_failed" integer DEFAULT 0 NOT NULL,
  "warning_count" integer DEFAULT 0 NOT NULL,
  "error_code" text,
  "message" text,
  "attempt_count" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "source_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "owner" text,
  "repo" text,
  "branch" text,
  "pat_encrypted_ref" text,
  "upload_label" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "source_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "path" text NOT NULL,
  "sha256" text,
  "language" text,
  "language_confidence" integer,
  "loc" integer,
  "classification" text,
  "analysis_status" text DEFAULT 'pending' NOT NULL,
  "parser_id" text,
  "parser_version" text,
  "module_id" uuid,
  "attributes" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "source_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "source_connection_id" uuid,
  "commit_sha" text,
  "acquired_at" timestamp DEFAULT now() NOT NULL,
  "file_count" integer DEFAULT 0 NOT NULL
);

ALTER TABLE "module_memberships" ADD CONSTRAINT "module_memberships_module_id_p1_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."p1_modules"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "module_memberships" ADD CONSTRAINT "module_memberships_source_file_id_source_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."source_files"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "p1_modules" ADD CONSTRAINT "p1_modules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "p1_scans" ADD CONSTRAINT "p1_scans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "p1_scans" ADD CONSTRAINT "p1_scans_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "scan_issues" ADD CONSTRAINT "scan_issues_scan_id_p1_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."p1_scans"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "scan_issues" ADD CONSTRAINT "scan_issues_source_file_id_source_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."source_files"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "scan_stages" ADD CONSTRAINT "scan_stages_scan_id_p1_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."p1_scans"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "source_connections" ADD CONSTRAINT "source_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "source_snapshots" ADD CONSTRAINT "source_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "source_snapshots" ADD CONSTRAINT "source_snapshots_source_connection_id_source_connections_id_fk" FOREIGN KEY ("source_connection_id") REFERENCES "public"."source_connections"("id") ON DELETE no action ON UPDATE no action;
```

## Rules

- Never run `drizzle-kit push` against the shared Neon database.
- Always generate migrations with `drizzle-kit generate`, review the SQL, then apply manually.
- Migration file names must not be renamed after being applied.
- New migrations always use the next sequential idx (current highest: 6).
