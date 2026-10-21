import { eq, desc, inArray } from 'drizzle-orm';
import { getDb } from './client';
import * as schema from './schema';
import type { AppCapability } from '../parser/types';
import { getModuleFactsForPrograms } from './documentation';

export async function createAppScope(data: {
  repoId: string;
  name: string;
  memberProgramIds: string[];
  seedMethod: 'cluster' | 'job-chain' | 'manual';
  seedRef?: string;
  crossesClusters?: boolean;
  createdBy?: string;
}): Promise<typeof schema.appScopes.$inferSelect> {
  const db = getDb();
  const [row] = await db
    .insert(schema.appScopes)
    .values({
      repoId: data.repoId,
      name: data.name,
      memberProgramIds: data.memberProgramIds,
      seedMethod: data.seedMethod,
      seedRef: data.seedRef ?? null,
      crossesClusters: data.crossesClusters ?? false,
      createdBy: data.createdBy ?? null,
    })
    .returning();
  return row;
}

export async function listAppScopes(repoId: string): Promise<(typeof schema.appScopes.$inferSelect)[]> {
  const db = getDb();
  return db.select().from(schema.appScopes).where(eq(schema.appScopes.repoId, repoId)).orderBy(desc(schema.appScopes.createdAt));
}

export async function getAppScope(id: string): Promise<typeof schema.appScopes.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db.select().from(schema.appScopes).where(eq(schema.appScopes.id, id)).limit(1);
  return row;
}

export async function saveAppCapabilityMap(
  scopeId: string,
  sourceFactsHash: string,
  capabilities: AppCapability[]
): Promise<void> {
  const db = getDb();
  await db.insert(schema.appCapabilityMaps).values({ scopeId, sourceFactsHash, capabilities });
}

export async function getAppCapabilityMap(
  scopeId: string
): Promise<typeof schema.appCapabilityMaps.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db.select().from(schema.appCapabilityMaps).where(eq(schema.appCapabilityMaps.scopeId, scopeId)).orderBy(desc(schema.appCapabilityMaps.generatedAt)).limit(1);
  return row;
}

export async function saveAppBrd(
  scopeId: string,
  sourceFactsHash: string,
  sections: (typeof schema.appBrds.$inferInsert)['sections']
): Promise<void> {
  const db = getDb();
  await db.insert(schema.appBrds).values({ scopeId, sourceFactsHash, sections });
}

export async function getAppBrd(scopeId: string): Promise<typeof schema.appBrds.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db.select().from(schema.appBrds).where(eq(schema.appBrds.scopeId, scopeId)).orderBy(desc(schema.appBrds.generatedAt)).limit(1);
  return row;
}

export async function saveAppModSpec(
  scopeId: string,
  sourceFactsHash: string,
  sections: (typeof schema.appModSpecs.$inferInsert)['sections']
): Promise<void> {
  const db = getDb();
  await db.insert(schema.appModSpecs).values({ scopeId, sourceFactsHash, sections });
}

export async function getAppModSpec(scopeId: string): Promise<typeof schema.appModSpecs.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db.select().from(schema.appModSpecs).where(eq(schema.appModSpecs.scopeId, scopeId)).orderBy(desc(schema.appModSpecs.generatedAt)).limit(1);
  return row;
}

export async function saveAppImpact(
  scopeId: string,
  sourceFactsHash: string,
  items: (typeof schema.appImpacts.$inferInsert)['items']
): Promise<void> {
  const db = getDb();
  await db.insert(schema.appImpacts).values({ scopeId, sourceFactsHash, items });
}

export async function getAppImpact(scopeId: string): Promise<typeof schema.appImpacts.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db.select().from(schema.appImpacts).where(eq(schema.appImpacts.scopeId, scopeId)).orderBy(desc(schema.appImpacts.generatedAt)).limit(1);
  return row;
}

export async function getScopeCoverageGate(scopeId: string): Promise<{
  total: number; fresh: number; stale: number; missing: number; partial: number;
  programs: Array<{ id: string; name: string; status: 'fresh' | 'stale' | 'missing' | 'partial'; sourceHash?: string; factsHash?: string }>;
}> {
  const db = getDb();
  const scope = await getAppScope(scopeId);
  if (!scope) return { total: 0, fresh: 0, stale: 0, missing: 0, partial: 0, programs: [] };

  const memberIds = scope.memberProgramIds as string[];
  if (!memberIds.length) return { total: 0, fresh: 0, stale: 0, missing: 0, partial: 0, programs: [] };

  const progRows = await db.select().from(schema.programs).where(inArray(schema.programs.id, memberIds));
  const factsRows = await getModuleFactsForPrograms(memberIds);
  const factsMap = new Map(factsRows.map((f) => [f.programId, f]));

  const sourceRows = await db.select().from(schema.programSources).where(inArray(schema.programSources.programId, memberIds));
  const sourceMap = new Map<string, typeof sourceRows[0]>();
  for (const s of sourceRows) {
    const ex = sourceMap.get(s.programId);
    if (!ex || s.capturedAt > ex.capturedAt) sourceMap.set(s.programId, s);
  }

  const programs = progRows.map((p) => {
    const facts = factsMap.get(p.id);
    const source = sourceMap.get(p.id);
    if (!facts) return { id: p.id, name: p.name, status: 'missing' as const };
    const stale = source && source.sourceHash !== facts.sourceHash;
    return {
      id: p.id, name: p.name,
      status: stale ? ('stale' as const) : ('fresh' as const),
      sourceHash: source?.sourceHash,
      factsHash: facts.sourceHash,
    };
  });

  return {
    total: programs.length,
    fresh: programs.filter((p) => p.status === 'fresh').length,
    stale: programs.filter((p) => p.status === 'stale').length,
    missing: programs.filter((p) => p.status === 'missing').length,
    partial: 0,
    programs,
  };
}
