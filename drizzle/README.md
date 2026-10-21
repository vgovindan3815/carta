# Drizzle Migration History

## Applied migrations (linear history)

| idx | File | Applied | Notes |
|---|---|---|---|
| 0 | `0000_goofy_iron_lad.sql` | ✅ | Base tables: repos, programs, analysis_jobs, dep_graphs, biz_rules, change_impacts, mod_specs, settings, copybooks, domain_glossary, validations |
| 1 | `0001_moaning_chronomancer.sql` | ✅ | scan_jobs |
| 2 | `0002_fair_guardian.sql` | ✅ | v2.2 tables: program_sources, module_facts, graph_discrepancies, scan_completeness, app_scopes, app_capability_maps, app_brds, app_mod_specs, app_impacts, agent_runs; adds `kind` to copybooks |
| 3 | `0003_internal_flow.sql` | ✅ | Adds `internal_flow` JSONB column to `dep_graphs` |
| 4 | `0004_audit_events.sql` | ⚠️ **Apply manually — see below** | Creates `audit_events` table for admin action tracking |

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

**Pending right now — run this in Neon SQL console:**
```sql
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"target_name" text,
	"performed_by" text DEFAULT 'system' NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
```

Migrations 0000–0003 are confirmed applied. Migration 0004 is pending.

## Rules

- Never run `drizzle-kit push` against the shared Neon database.
- Always generate migrations with `drizzle-kit generate`, review the SQL, then apply manually.
- Migration file names must not be renamed after being applied.
- New migrations always use the next sequential idx (current highest: 3).
