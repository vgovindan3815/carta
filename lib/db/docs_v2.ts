import { eq, and, desc } from 'drizzle-orm';
import { createHash } from 'crypto';
import { getDb } from './client';
import { documentationRuns, documents, documentSections, contextManifests } from './schema';

export async function createDocumentationRun(data: {
  projectId: string;
  scanId?: string;
}) {
  const db = getDb();
  const [row] = await db.insert(documentationRuns).values({
    projectId: data.projectId,
    scanId: data.scanId ?? null,
  }).returning();
  return row;
}

export async function updateDocumentationRun(id: string, data: Partial<{
  status: string;
  chainIds: string[];
  tokensUsed: number;
  completedAt: Date;
}>) {
  const db = getDb();
  await db.update(documentationRuns).set(data).where(eq(documentationRuns.id, id));
}

export async function createDocument(data: {
  projectId: string;
  runId?: string;
  kind: string;
  targetId: string;
  title: string;
}) {
  const db = getDb();
  const [row] = await db.insert(documents).values({
    projectId: data.projectId,
    runId: data.runId ?? null,
    kind: data.kind,
    targetId: data.targetId,
    title: data.title,
  }).returning();
  return row;
}

export async function upsertDocumentSection(data: {
  documentId: string;
  sectionKey: string;
  sectionTitle: string;
  content: string;
  dependsOn?: string[];
  generatedBy?: string;
  tokensUsed?: number;
  factInputs?: string;
}) {
  const db = getDb();
  const factHash = data.factInputs
    ? createHash('sha256').update(data.factInputs).digest('hex')
    : null;

  const existing = await db.select().from(documentSections)
    .where(and(
      eq(documentSections.documentId, data.documentId),
      eq(documentSections.sectionKey, data.sectionKey),
    ));

  if (existing.length > 0) {
    await db.update(documentSections).set({
      sectionTitle: data.sectionTitle,
      content: data.content,
      factHash,
      dependsOn: data.dependsOn ?? null,
      staleness: 'current',
      generatedBy: data.generatedBy ?? null,
      tokensUsed: data.tokensUsed ?? 0,
      updatedAt: new Date(),
    }).where(eq(documentSections.id, existing[0].id));
    return;
  }

  await db.insert(documentSections).values({
    documentId: data.documentId,
    sectionKey: data.sectionKey,
    sectionTitle: data.sectionTitle,
    content: data.content,
    factHash,
    dependsOn: data.dependsOn ?? null,
    staleness: 'current',
    generatedBy: data.generatedBy ?? null,
    tokensUsed: data.tokensUsed ?? 0,
  });
}

export async function markSectionsStale(documentId: string, changedFactKeys: string[]) {
  const db = getDb();
  const sections = await db.select().from(documentSections)
    .where(eq(documentSections.documentId, documentId));

  for (const section of sections) {
    const deps = (section.dependsOn ?? []) as string[];
    const isStale = deps.some(k => changedFactKeys.includes(k));
    if (isStale && section.staleness !== 'stale') {
      await db.update(documentSections)
        .set({ staleness: 'stale' })
        .where(eq(documentSections.id, section.id));
    }
  }
}

export async function saveContextManifest(data: {
  runId: string;
  targetId: string;
  manifestData: Record<string, unknown>;
  factKeys?: string[];
}) {
  const db = getDb();
  await db.insert(contextManifests).values({
    runId: data.runId,
    targetId: data.targetId,
    manifestData: data.manifestData,
    factKeys: data.factKeys ?? null,
  });
}

export async function getDocumentsForProject(projectId: string) {
  const db = getDb();
  return db.select().from(documents)
    .where(eq(documents.projectId, projectId))
    .orderBy(desc(documents.updatedAt));
}

export async function getDocumentWithSections(documentId: string) {
  const db = getDb();
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!doc) return null;
  const sections = await db.select().from(documentSections)
    .where(eq(documentSections.documentId, documentId));
  return { ...doc, sections };
}
