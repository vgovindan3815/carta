-- Phase 1 backward compat: add project_id FK columns + synthetic projects for existing repos
-- Run each statement separately and verify before proceeding to the next.

-- 1. Add nullable project_id to repos
ALTER TABLE "repos" ADD COLUMN IF NOT EXISTS "project_id" uuid REFERENCES "projects"("id");

-- 2. Add nullable project_id to programs
ALTER TABLE "programs" ADD COLUMN IF NOT EXISTS "project_id" uuid REFERENCES "projects"("id");

-- 3. Create a synthetic project for each existing repo (idempotent via ON CONFLICT DO NOTHING)
INSERT INTO "projects" (id, name, description, created_by, created_at, updated_at)
SELECT
  gen_random_uuid(),
  r.repo,
  'Auto-created from repo ' || r.owner || '/' || r.repo,
  'system',
  r.created_at,
  now()
FROM "repos" r
ON CONFLICT DO NOTHING;

-- 4. Link repos to their synthetic project
--    Run ONLY after verifying step 3 inserted the correct projects.
--    Matches by repo name (assumes unique repo names; adjust if needed).
-- UPDATE "repos" r
--   SET project_id = p.id
--   FROM "projects" p
--   WHERE p.name = r.repo AND r.project_id IS NULL;

-- 5. Backfill programs.project_id from their repo's project_id
--    Run ONLY after step 4 is verified.
-- UPDATE "programs" pr
--   SET project_id = r.project_id
--   FROM "repos" r
--   WHERE pr.repo_id = r.id AND pr.project_id IS NULL;
