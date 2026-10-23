import { eq, desc, and, inArray } from 'drizzle-orm';
import { getDb } from './client';
import * as schema from './schema';
import type { GraphDiscrepancy } from '../parser/types';

export async function saveDepGraph(
  programId: string,
  jobId: string,
  data: {
    nodes: (typeof schema.depGraphs.$inferInsert)['nodes'];
    edges: (typeof schema.depGraphs.$inferInsert)['edges'];
    coveragePct: number;
    cLayoutNodes?: (typeof schema.depGraphs.$inferInsert)['cLayoutNodes'];
    internalFlow?: (typeof schema.depGraphs.$inferInsert)['internalFlow'];
  }
): Promise<string> {
  const db = getDb();
  const [row] = await db.insert(schema.depGraphs).values({
    programId,
    jobId,
    nodes: data.nodes,
    edges: data.edges,
    coveragePct: data.coveragePct,
    cLayoutNodes: data.cLayoutNodes ?? null,
    internalFlow: data.internalFlow ?? null,
  }).returning({ id: schema.depGraphs.id });

  await db
    .update(schema.programs)
    .set({ lastAnalyzedAt: new Date() })
    .where(eq(schema.programs.id, programId));

  return row.id;
}

/** Attach LLM-generated code quality analysis to an existing dep_graph row's internalFlow JSONB. */
export async function updateDepGraphCodeQuality(depGraphId: string, codeQuality: unknown): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ internalFlow: schema.depGraphs.internalFlow })
    .from(schema.depGraphs)
    .where(eq(schema.depGraphs.id, depGraphId))
    .limit(1);
  if (!row) return;
  const current = (row.internalFlow ?? {}) as Record<string, unknown>;
  const updated = { ...current, codeQuality };
  await db
    .update(schema.depGraphs)
    .set({ internalFlow: updated as (typeof schema.depGraphs.$inferInsert)['internalFlow'] })
    .where(eq(schema.depGraphs.id, depGraphId));
}

/** Attach LLM-generated Mermaid CFG to an existing dep_graph row's internalFlow JSONB. */
export async function updateDepGraphMermaid(depGraphId: string, mermaidCfg: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ internalFlow: schema.depGraphs.internalFlow })
    .from(schema.depGraphs)
    .where(eq(schema.depGraphs.id, depGraphId))
    .limit(1);
  if (!row) return;
  const current = (row.internalFlow ?? {}) as Record<string, unknown>;
  const updated = { ...current, mermaidCfg };
  await db
    .update(schema.depGraphs)
    .set({ internalFlow: updated as (typeof schema.depGraphs.$inferInsert)['internalFlow'] })
    .where(eq(schema.depGraphs.id, depGraphId));
}

export async function getMostRecentDepGraph(
  programId: string
): Promise<typeof schema.depGraphs.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.depGraphs)
    .where(eq(schema.depGraphs.programId, programId))
    .orderBy(desc(schema.depGraphs.createdAt))
    .limit(1);
  return row;
}

export async function getJclCallers(programName: string, repoId: string): Promise<string[]> {
  const db = getDb();
  const jclProgs = await db
    .select()
    .from(schema.programs)
    .where(and(eq(schema.programs.repoId, repoId), inArray(schema.programs.language, ['JCL', 'PROC'])));

  if (!jclProgs.length) return [];

  const jclProgIds = jclProgs.map((p) => p.id);
  const depGraphRows = await db
    .select()
    .from(schema.depGraphs)
    .where(inArray(schema.depGraphs.programId, jclProgIds));

  const latestByProg = new Map<string, typeof depGraphRows[0]>();
  for (const dg of depGraphRows) {
    const existing = latestByProg.get(dg.programId);
    if (!existing || dg.createdAt > existing.createdAt) {
      latestByProg.set(dg.programId, dg);
    }
  }

  const upperName = programName.toUpperCase();
  const callers: string[] = [];
  for (const jclProg of jclProgs) {
    const dg = latestByProg.get(jclProg.id);
    if (!dg) continue;
    const edges = dg.edges as Array<{ from: string; to: string; type: string }>;
    if (edges.some((e) => e.to.toUpperCase() === upperName)) {
      callers.push(jclProg.name);
    }
  }
  return callers;
}

export async function saveGraphDiscrepancies(
  programId: string,
  jobId: string,
  sourceHash: string,
  discrepancies: GraphDiscrepancy[]
): Promise<void> {
  if (!discrepancies.length) return;
  const db = getDb();
  await db.insert(schema.graphDiscrepancies).values(
    discrepancies.map((d) => ({
      programId,
      jobId,
      sourceHash,
      staticEdge: d.staticEdge,
      llmObservation: d.observation,
      confidence: d.confidence,
      status: 'unreviewed' as const,
    }))
  );
}

export async function getGraphDiscrepancies(
  programId: string
): Promise<(typeof schema.graphDiscrepancies.$inferSelect)[]> {
  const db = getDb();
  return db
    .select()
    .from(schema.graphDiscrepancies)
    .where(and(eq(schema.graphDiscrepancies.programId, programId), eq(schema.graphDiscrepancies.status, 'unreviewed')))
    .orderBy(desc(schema.graphDiscrepancies.createdAt));
}
