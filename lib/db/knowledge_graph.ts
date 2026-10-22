import { eq, and } from 'drizzle-orm';
import { getDb } from './client';
import {
  kgNodes,
  kgEdges,
  evidenceRecords,
  corrections,
} from './schema';

export async function upsertKgNode(data: {
  projectId: string;
  nodeType: string;
  canonicalKey: string;
  attributes?: Record<string, unknown>;
}) {
  const db = getDb();
  const existing = await db.select().from(kgNodes).where(
    and(
      eq(kgNodes.projectId, data.projectId),
      eq(kgNodes.nodeType, data.nodeType),
      eq(kgNodes.canonicalKey, data.canonicalKey),
    ),
  );
  if (existing.length > 0) {
    if (data.attributes) {
      await db.update(kgNodes).set({ attributes: data.attributes }).where(eq(kgNodes.id, existing[0].id));
    }
    return existing[0];
  }
  const [row] = await db.insert(kgNodes).values({
    projectId: data.projectId,
    nodeType: data.nodeType,
    canonicalKey: data.canonicalKey,
    attributes: data.attributes ?? null,
  }).returning();
  return row;
}

export async function upsertKgEdge(data: {
  projectId: string;
  srcNodeId: string;
  dstNodeId: string;
  relType: string;
  discriminator?: string;
  attributes?: Record<string, unknown>;
}) {
  const db = getDb();
  const disc = data.discriminator ?? 'default';
  const existing = await db.select().from(kgEdges).where(
    and(
      eq(kgEdges.projectId, data.projectId),
      eq(kgEdges.srcNodeId, data.srcNodeId),
      eq(kgEdges.dstNodeId, data.dstNodeId),
      eq(kgEdges.relType, data.relType),
      eq(kgEdges.discriminator, disc),
    ),
  );
  if (existing.length > 0) return existing[0];
  const [row] = await db.insert(kgEdges).values({
    projectId: data.projectId,
    srcNodeId: data.srcNodeId,
    dstNodeId: data.dstNodeId,
    relType: data.relType,
    discriminator: disc,
    attributes: data.attributes ?? null,
  }).returning();
  return row;
}

export async function getKgNodesForProject(projectId: string) {
  const db = getDb();
  return db.select().from(kgNodes).where(eq(kgNodes.projectId, projectId));
}

export async function getKgEdgesForProject(projectId: string) {
  const db = getDb();
  return db.select().from(kgEdges).where(eq(kgEdges.projectId, projectId));
}

export async function addEvidence(data: {
  projectId: string;
  nodeOrEdgeId: string;
  nodeOrEdgeKind: 'node' | 'edge';
  analyzerId: string;
  analyzerVersion: string;
  sourceFileId?: string;
  lineStart?: number;
  lineEnd?: number;
  construct?: string;
  confidence?: number;
  attributes?: Record<string, unknown>;
}) {
  const db = getDb();
  await db.insert(evidenceRecords).values({
    projectId: data.projectId,
    nodeOrEdgeId: data.nodeOrEdgeId,
    nodeOrEdgeKind: data.nodeOrEdgeKind,
    analyzerId: data.analyzerId,
    analyzerVersion: data.analyzerVersion,
    sourceFileId: data.sourceFileId ?? null,
    lineStart: data.lineStart ?? null,
    lineEnd: data.lineEnd ?? null,
    construct: data.construct ?? null,
    confidence: data.confidence ?? 100,
    attributes: data.attributes ?? null,
  });
}

export async function addCorrection(data: {
  projectId: string;
  nodeKey?: string;
  edgeSrcKey?: string;
  edgeDstKey?: string;
  edgeRelType?: string;
  originalValue?: Record<string, unknown>;
  correctedValue?: Record<string, unknown>;
  reviewer: string;
  reason?: string;
  snapshotScope?: boolean;
}) {
  const db = getDb();
  const [row] = await db.insert(corrections).values({
    projectId: data.projectId,
    nodeKey: data.nodeKey ?? null,
    edgeSrcKey: data.edgeSrcKey ?? null,
    edgeDstKey: data.edgeDstKey ?? null,
    edgeRelType: data.edgeRelType ?? null,
    originalValue: data.originalValue ?? null,
    correctedValue: data.correctedValue ?? null,
    reviewer: data.reviewer,
    reason: data.reason ?? null,
    snapshotScope: data.snapshotScope ?? false,
  }).returning();
  return row;
}

export async function getCorrectionsForProject(projectId: string) {
  const db = getDb();
  return db.select().from(corrections).where(eq(corrections.projectId, projectId));
}
