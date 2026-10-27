import { eq, desc, inArray, count, sum } from 'drizzle-orm';
import { getDb } from './client';
import * as schema from './schema';

export async function createRepo(data: {
  projectName?: string;
  githubUrl: string;
  owner: string;
  repo: string;
  branch: string;
  patEncrypted?: string;
}): Promise<typeof schema.repos.$inferSelect> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schema.repos)
    .where(eq(schema.repos.githubUrl, data.githubUrl))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(schema.repos)
      .set({
        projectName: data.projectName ?? existing.projectName,
        lastSyncedAt: new Date(),
        patEncrypted: data.patEncrypted ?? existing.patEncrypted,
      })
      .where(eq(schema.repos.id, existing.id))
      .returning();
    return updated;
  }

  const [row] = await db
    .insert(schema.repos)
    .values({
      projectName: data.projectName ?? 'Default Project',
      githubUrl: data.githubUrl,
      owner: data.owner,
      repo: data.repo,
      branch: data.branch,
      patEncrypted: data.patEncrypted ?? null,
    })
    .returning();
  return row;
}

export async function deleteProject(repoId: string): Promise<void> {
  const db = getDb();
  const progs = await db
    .select({ id: schema.programs.id })
    .from(schema.programs)
    .where(eq(schema.programs.repoId, repoId));
  const progIds = progs.map((p) => p.id);

  if (progIds.length > 0) {
    const jobs = await db
      .select({ id: schema.analysisJobs.id })
      .from(schema.analysisJobs)
      .where(inArray(schema.analysisJobs.programId, progIds));
    const jobIds = jobs.map((j) => j.id);

    if (jobIds.length > 0) {
      await db.delete(schema.graphDiscrepancies).where(inArray(schema.graphDiscrepancies.jobId, jobIds));
      await db.delete(schema.moduleFacts).where(inArray(schema.moduleFacts.jobId, jobIds));
      await db.delete(schema.depGraphs).where(inArray(schema.depGraphs.jobId, jobIds));
      await db.delete(schema.bizRules).where(inArray(schema.bizRules.jobId, jobIds));
      await db.delete(schema.changeImpacts).where(inArray(schema.changeImpacts.jobId, jobIds));
      await db.delete(schema.modSpecs).where(inArray(schema.modSpecs.jobId, jobIds));
      await db.delete(schema.analysisJobs).where(inArray(schema.analysisJobs.id, jobIds));
    }
    await db.delete(schema.programSources).where(inArray(schema.programSources.programId, progIds));
    await db.delete(schema.validations).where(inArray(schema.validations.programId, progIds));
    await db.delete(schema.programs).where(inArray(schema.programs.id, progIds));
  }

  const scanJobs = await db
    .select({ id: schema.scanJobs.id })
    .from(schema.scanJobs)
    .where(eq(schema.scanJobs.repoId, repoId));
  const scanJobIds = scanJobs.map((s) => s.id);
  if (scanJobIds.length > 0) {
    await db.delete(schema.scanCompleteness).where(inArray(schema.scanCompleteness.scanJobId, scanJobIds));
    await db.delete(schema.scanJobs).where(inArray(schema.scanJobs.id, scanJobIds));
  }

  const scopes = await db
    .select({ id: schema.appScopes.id })
    .from(schema.appScopes)
    .where(eq(schema.appScopes.repoId, repoId));
  const scopeIds = scopes.map((s) => s.id);
  if (scopeIds.length > 0) {
    await db.delete(schema.appCapabilityMaps).where(inArray(schema.appCapabilityMaps.scopeId, scopeIds));
    await db.delete(schema.appBrds).where(inArray(schema.appBrds.scopeId, scopeIds));
    await db.delete(schema.appModSpecs).where(inArray(schema.appModSpecs.scopeId, scopeIds));
    await db.delete(schema.appImpacts).where(inArray(schema.appImpacts.scopeId, scopeIds));
    await db.delete(schema.appScopes).where(inArray(schema.appScopes.id, scopeIds));
  }

  await db.delete(schema.agentRuns).where(eq(schema.agentRuns.repoId, repoId));
  await db.delete(schema.copybooks).where(eq(schema.copybooks.repoId, repoId));
  await db.delete(schema.domainGlossary).where(eq(schema.domainGlossary.repoId, repoId));
  await db.delete(schema.repos).where(eq(schema.repos.id, repoId));
}

export async function clearAllProjects(): Promise<void> {
  const db = getDb();
  await db.delete(schema.graphDiscrepancies);
  await db.delete(schema.moduleFacts);
  await db.delete(schema.depGraphs);
  await db.delete(schema.bizRules);
  await db.delete(schema.changeImpacts);
  await db.delete(schema.modSpecs);
  await db.delete(schema.analysisJobs);
  await db.delete(schema.programSources);
  await db.delete(schema.validations);
  await db.delete(schema.programs);
  await db.delete(schema.scanCompleteness);
  await db.delete(schema.scanJobs);
  await db.delete(schema.appCapabilityMaps);
  await db.delete(schema.appBrds);
  await db.delete(schema.appModSpecs);
  await db.delete(schema.appImpacts);
  await db.delete(schema.appScopes);
  await db.delete(schema.agentRuns);
  await db.delete(schema.copybooks);
  await db.delete(schema.domainGlossary);
  await db.delete(schema.repos);
}

export async function getAdminStats(): Promise<{
  repos: number; programs: number; jobs: number; totalTokens: number;
}> {
  const db = getDb();
  const [r] = await db.select({ c: count() }).from(schema.repos);
  const [p] = await db.select({ c: count() }).from(schema.programs);
  const [j] = await db.select({ c: count() }).from(schema.analysisJobs);
  const [t] = await db.select({ s: sum(schema.analysisJobs.tokensUsed) }).from(schema.analysisJobs);
  return {
    repos: Number(r.c),
    programs: Number(p.c),
    jobs: Number(j.c),
    totalTokens: Number(t.s ?? 0),
  };
}

export async function createScanJob(repoId: string): Promise<{ id: string }> {
  const db = getDb();
  const [row] = await db.insert(schema.scanJobs).values({ repoId }).returning({ id: schema.scanJobs.id });
  return row;
}

export async function updateScanJob(
  id: string,
  patch: Partial<{ status: string; scannedFiles: number; totalFiles: number; error: string; completedAt: Date }>
): Promise<void> {
  const db = getDb();
  await db.update(schema.scanJobs).set(patch as Record<string, unknown>).where(eq(schema.scanJobs.id, id));
}

export async function getScanJob(id: string): Promise<typeof schema.scanJobs.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db.select().from(schema.scanJobs).where(eq(schema.scanJobs.id, id)).limit(1);
  return row;
}

export async function getLatestScanJob(repoId: string): Promise<typeof schema.scanJobs.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db.select().from(schema.scanJobs)
    .where(eq(schema.scanJobs.repoId, repoId))
    .orderBy(desc(schema.scanJobs.createdAt))
    .limit(1);
  return row;
}

export async function listRepos(): Promise<typeof schema.repos.$inferSelect[]> {
  const db = getDb();
  return db.select().from(schema.repos).orderBy(desc(schema.repos.createdAt));
}

export async function getRepo(id: string): Promise<typeof schema.repos.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db.select().from(schema.repos).where(eq(schema.repos.id, id)).limit(1);
  return row;
}

export { deleteProject as deleteRepo };

// ---------------------------------------------------------------------------
// Bridge: repos ↔ projects (Phase 2 kg population)
// ---------------------------------------------------------------------------

/**
 * Find the repo whose projectId matches (e.g. when UploadReportButton sends
 * a projects.id as repoId).
 */
export async function getRepoByProjectId(
  projectId: string,
): Promise<typeof schema.repos.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.repos)
    .where(eq(schema.repos.projectId, projectId))
    .limit(1);
  return row;
}

/**
 * Ensure the given repo is linked to a projects row, creating one if needed.
 * Returns the projects.id to use for kg_nodes / kg_edges / evidence_records.
 */
export async function upsertProjectForRepo(repoId: string): Promise<string | null> {
  const db = getDb();
  const [repo] = await db
    .select()
    .from(schema.repos)
    .where(eq(schema.repos.id, repoId))
    .limit(1);
  if (!repo) return null;

  if (repo.projectId) return repo.projectId;

  // Try to find an existing project whose name matches the repo name
  const [existing] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.name, repo.repo))
    .limit(1);

  const projectId = existing
    ? existing.id
    : await (async () => {
        const [created] = await db
          .insert(schema.projects)
          .values({
            name: repo.projectName !== 'Default Project' ? repo.projectName : repo.repo,
            description: `Auto-linked from repo ${repo.owner}/${repo.repo}`,
            createdBy: 'cast-import',
          })
          .returning();
        return created.id;
      })();

  // Link the repo to the project for future lookups
  await db
    .update(schema.repos)
    .set({ projectId })
    .where(eq(schema.repos.id, repoId));

  return projectId;
}

export async function recordAuditEvent(event: {
  action: string;
  targetType: string;
  targetId?: string;
  targetName?: string;
  performedBy?: string;
  reason?: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(schema.auditEvents).values({
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId ?? null,
    targetName: event.targetName ?? null,
    performedBy: event.performedBy ?? 'system',
    reason: event.reason ?? null,
  });
}

export async function getAuditEvents(
  limit = 50
): Promise<typeof schema.auditEvents.$inferSelect[]> {
  const db = getDb();
  return db
    .select()
    .from(schema.auditEvents)
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(limit);
}
