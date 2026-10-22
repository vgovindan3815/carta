import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { getDb } from './client';
import * as schema from './schema';

export async function upsertProgram(data: {
  repoId: string;
  name: string;
  language: string;
  loc: number;
  domain?: string;
  desc?: string;
  filePath: string;
  lastCommitSha?: string;
}): Promise<typeof schema.programs.$inferSelect> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schema.programs)
    .where(eq(schema.programs.name, data.name))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(schema.programs)
      .set({
        language: data.language,
        loc: data.loc,
        domain: data.domain ?? existing.domain,
        desc: data.desc ?? existing.desc,
        filePath: data.filePath,
        lastCommitSha: data.lastCommitSha ?? existing.lastCommitSha,
      })
      .where(eq(schema.programs.id, existing.id))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(schema.programs)
    .values({
      repoId: data.repoId,
      name: data.name,
      language: data.language,
      loc: data.loc,
      domain: data.domain ?? null,
      desc: data.desc ?? null,
      filePath: data.filePath,
      lastCommitSha: data.lastCommitSha ?? null,
    })
    .returning();
  return inserted;
}

export async function updateProgramDesc(id: string, desc: string): Promise<void> {
  const db = getDb();
  await db.update(schema.programs).set({ desc }).where(eq(schema.programs.id, id));
}

export async function listPrograms(repoId?: string, projectId?: string): Promise<typeof schema.programs.$inferSelect[]> {
  const db = getDb();
  const conditions = [];
  if (repoId) conditions.push(eq(schema.programs.repoId, repoId));
  if (projectId) conditions.push(eq(schema.programs.projectId, projectId));

  const rows = await (conditions.length > 0
    ? db.select().from(schema.programs).where(and(...conditions)).orderBy(schema.programs.name)
    : db.select().from(schema.programs).orderBy(desc(schema.programs.createdAt)));

  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });
}

export async function getDocStatusForPrograms(
  programIds: string[]
): Promise<Record<string, 'documented' | 'cast_only' | 'not_analyzed'>> {
  if (programIds.length === 0) return {};
  const db = getDb();

  const rows = await db
    .select({ programId: schema.analysisJobs.programId, tokensUsed: schema.analysisJobs.tokensUsed })
    .from(schema.analysisJobs)
    .where(and(inArray(schema.analysisJobs.programId, programIds), eq(schema.analysisJobs.status, 'completed')));

  const result: Record<string, 'documented' | 'cast_only' | 'not_analyzed'> = {};
  for (const id of programIds) result[id] = 'not_analyzed';

  for (const row of rows) {
    const id = row.programId;
    if ((row.tokensUsed ?? 0) > 0) {
      result[id] = 'documented';
    } else if (result[id] !== 'documented') {
      result[id] = 'cast_only';
    }
  }

  return result;
}

export async function getProgram(name: string): Promise<typeof schema.programs.$inferSelect | undefined> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.programs)
    .where(eq(schema.programs.name, name))
    .orderBy(sql`CASE WHEN ${schema.programs.language} IN ('COBOL','JCL','PLI','PROC','COPYBOOK') THEN 0 ELSE 1 END`)
    .limit(2);
  return rows[0];
}

export async function getProgramById(id: string): Promise<typeof schema.programs.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db.select().from(schema.programs).where(eq(schema.programs.id, id)).limit(1);
  return row;
}

export function hashSource(sourceText: string): string {
  return createHash('sha256').update(sourceText, 'utf8').digest('hex');
}

const MAX_SOURCE_BYTES = 2 * 1024 * 1024; // 2MB soft limit

export async function saveProgramSource(
  programId: string,
  sourceText: string,
  commitSha?: string
): Promise<void> {
  const db = getDb();
  let textToStore = sourceText;
  if (Buffer.byteLength(sourceText, 'utf8') > MAX_SOURCE_BYTES) {
    textToStore =
      sourceText.slice(0, 1_900_000) +
      '\n\n[TRUNCATED: source exceeds 2MB limit. SHA256 preserved for identity.]';
  }
  const sourceHash = hashSource(sourceText); // hash original, not truncated
  const loc = textToStore.split('\n').length;
  await db.insert(schema.programSources).values({
    programId,
    commitSha: commitSha ?? null,
    sourceText: textToStore,
    sourceHash,
    loc,
  });
}

export async function deleteProgram(id: string): Promise<void> {
  const db = getDb();
  const jobs = await db
    .select({ id: schema.analysisJobs.id })
    .from(schema.analysisJobs)
    .where(eq(schema.analysisJobs.programId, id));
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
  await db.delete(schema.programSources).where(eq(schema.programSources.programId, id));
  await db.delete(schema.validations).where(eq(schema.validations.programId, id));
  await db.delete(schema.programs).where(eq(schema.programs.id, id));
}

export async function getProgramSource(
  programId: string
): Promise<typeof schema.programSources.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.programSources)
    .where(eq(schema.programSources.programId, programId))
    .orderBy(desc(schema.programSources.capturedAt))
    .limit(1);
  return row;
}
