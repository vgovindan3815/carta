import { eq, desc } from 'drizzle-orm';
import { getDb } from './client';
import * as schema from './schema';

export async function createAgentRun(data: {
  repoId?: string;
  programName?: string;
  query: string;
  provider: string;
  model: string;
}): Promise<{ id: string }> {
  const db = getDb();
  const [row] = await db.insert(schema.agentRuns).values(data).returning({ id: schema.agentRuns.id });
  return row;
}

export async function updateAgentRun(
  id: string,
  patch: Partial<{
    status: string;
    messages: object[];
    toolCalls: object[];
    response: string;
    tokensUsed: number;
    error: string;
    completedAt: Date;
  }>
): Promise<void> {
  const db = getDb();
  await db.update(schema.agentRuns).set(patch).where(eq(schema.agentRuns.id, id));
}

export async function listAgentRuns(limit = 50): Promise<(typeof schema.agentRuns.$inferSelect)[]> {
  const db = getDb();
  return db.select().from(schema.agentRuns).orderBy(desc(schema.agentRuns.createdAt)).limit(limit);
}

export async function getAgentRun(id: string): Promise<typeof schema.agentRuns.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, id)).limit(1);
  return row;
}
