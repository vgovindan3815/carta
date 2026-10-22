import { eq, desc, and } from 'drizzle-orm';
import { getDb } from './client';
import {
  projects,
  sourceConnections,
  sourceSnapshots,
  sourceFiles,
  p1Modules,
  moduleMemberships,
  p1Scans,
  scanStages,
  scanIssues,
} from './schema';

// ── Projects ──────────────────────────────────────────────────────────────

export async function createProject(data: {
  name: string;
  description?: string;
  createdBy?: string;
}) {
  const db = getDb();
  const [row] = await db.insert(projects).values({
    name: data.name,
    description: data.description ?? null,
    createdBy: data.createdBy ?? 'system',
  }).returning();
  return row;
}

export async function getProject(id: string) {
  const db = getDb();
  const [row] = await db.select().from(projects).where(eq(projects.id, id));
  return row ?? null;
}

export async function listProjects() {
  const db = getDb();
  return db.select().from(projects).orderBy(desc(projects.createdAt));
}

export async function deleteProjectById(id: string) {
  const db = getDb();
  await db.delete(projects).where(eq(projects.id, id));
}

// ── Source connections ─────────────────────────────────────────────────────

export async function createSourceConnection(data: {
  projectId: string;
  kind: 'github' | 'upload';
  owner?: string;
  repo?: string;
  branch?: string;
  patEncryptedRef?: string;
  uploadLabel?: string;
}) {
  const db = getDb();
  const [row] = await db.insert(sourceConnections).values({
    projectId: data.projectId,
    kind: data.kind,
    owner: data.owner ?? null,
    repo: data.repo ?? null,
    branch: data.branch ?? null,
    patEncryptedRef: data.patEncryptedRef ?? null,
    uploadLabel: data.uploadLabel ?? null,
  }).returning();
  return row;
}

export async function getSourceConnectionsForProject(projectId: string) {
  const db = getDb();
  return db.select().from(sourceConnections).where(eq(sourceConnections.projectId, projectId));
}

// ── Snapshots ──────────────────────────────────────────────────────────────

export async function createSnapshot(data: {
  projectId: string;
  sourceConnectionId?: string;
  commitSha?: string;
  fileCount?: number;
}) {
  const db = getDb();
  const [row] = await db.insert(sourceSnapshots).values({
    projectId: data.projectId,
    sourceConnectionId: data.sourceConnectionId ?? null,
    commitSha: data.commitSha ?? null,
    fileCount: data.fileCount ?? 0,
  }).returning();
  return row;
}

export async function updateSnapshot(id: string, data: Partial<{ fileCount: number; commitSha: string }>) {
  const db = getDb();
  const [row] = await db.update(sourceSnapshots).set(data).where(eq(sourceSnapshots.id, id)).returning();
  return row;
}

// ── Source files ───────────────────────────────────────────────────────────

export async function upsertSourceFile(data: {
  snapshotId: string;
  path: string;
  sha256?: string;
  language?: string;
  languageConfidence?: number;
  loc?: number;
  classification?: string;
  parserId?: string;
  parserVersion?: string;
  attributes?: Record<string, unknown>;
}) {
  const db = getDb();
  const [row] = await db.insert(sourceFiles).values({
    snapshotId: data.snapshotId,
    path: data.path,
    sha256: data.sha256 ?? null,
    language: data.language ?? null,
    languageConfidence: data.languageConfidence ?? null,
    loc: data.loc ?? null,
    classification: data.classification ?? null,
    analysisStatus: 'pending',
    parserId: data.parserId ?? null,
    parserVersion: data.parserVersion ?? null,
    attributes: data.attributes ?? null,
  })
  .onConflictDoNothing()
  .returning();
  return row;
}

export async function updateSourceFileStatus(id: string, status: string, data?: {
  loc?: number;
  parserId?: string;
  parserVersion?: string;
}) {
  const db = getDb();
  await db.update(sourceFiles).set({ analysisStatus: status, ...data }).where(eq(sourceFiles.id, id));
}

export async function getSourceFilesForSnapshot(snapshotId: string) {
  const db = getDb();
  return db.select().from(sourceFiles).where(eq(sourceFiles.snapshotId, snapshotId));
}

// ── Modules ────────────────────────────────────────────────────────────────

export async function createModule(data: {
  projectId: string;
  name: string;
  ruleSource?: string;
}) {
  const db = getDb();
  const [row] = await db.insert(p1Modules).values({
    projectId: data.projectId,
    name: data.name,
    ruleSource: data.ruleSource ?? 'auto',
  }).returning();
  return row;
}

export async function addModuleMembership(moduleId: string, sourceFileId: string, assignedBy = 'auto') {
  const db = getDb();
  await db.insert(moduleMemberships).values({ moduleId, sourceFileId, assignedBy }).onConflictDoNothing();
}

// ── Scans ──────────────────────────────────────────────────────────────────

export async function createP1Scan(data: { projectId: string; snapshotId?: string }) {
  const db = getDb();
  const [row] = await db.insert(p1Scans).values({
    projectId: data.projectId,
    snapshotId: data.snapshotId ?? null,
  }).returning();
  return row;
}

export async function updateP1Scan(id: string, data: Partial<{
  status: string;
  headlineStatus: string;
  inngestRunId: string;
  snapshotId: string;
  completedAt: Date;
}>) {
  const db = getDb();
  const [row] = await db.update(p1Scans).set(data).where(eq(p1Scans.id, id)).returning();
  return row;
}

export async function getP1Scan(id: string) {
  const db = getDb();
  const [row] = await db.select().from(p1Scans).where(eq(p1Scans.id, id));
  return row ?? null;
}

export async function listP1ScansForProject(projectId: string) {
  const db = getDb();
  return db.select().from(p1Scans)
    .where(eq(p1Scans.projectId, projectId))
    .orderBy(desc(p1Scans.createdAt));
}

// ── Scan stages ────────────────────────────────────────────────────────────

export async function upsertScanStage(data: {
  scanId: string;
  stageName: string;
  status: string;
  startedAt?: Date;
  completedAt?: Date;
  itemsProcessed?: number;
  itemsFailed?: number;
  warningCount?: number;
  errorCode?: string;
  message?: string;
  attemptCount?: number;
}) {
  const db = getDb();
  const existing = await db.select().from(scanStages)
    .where(and(eq(scanStages.scanId, data.scanId), eq(scanStages.stageName, data.stageName)));

  if (existing.length > 0) {
    await db.update(scanStages).set({
      status: data.status,
      startedAt: data.startedAt ?? existing[0].startedAt,
      completedAt: data.completedAt ?? null,
      itemsProcessed: data.itemsProcessed ?? existing[0].itemsProcessed,
      itemsFailed: data.itemsFailed ?? existing[0].itemsFailed,
      warningCount: data.warningCount ?? existing[0].warningCount,
      errorCode: data.errorCode ?? null,
      message: data.message ?? null,
      attemptCount: (existing[0].attemptCount ?? 0) + 1,
    }).where(and(eq(scanStages.scanId, data.scanId), eq(scanStages.stageName, data.stageName)));
    return;
  }

  await db.insert(scanStages).values({
    scanId: data.scanId,
    stageName: data.stageName,
    status: data.status,
    startedAt: data.startedAt ?? null,
    completedAt: data.completedAt ?? null,
    itemsProcessed: data.itemsProcessed ?? 0,
    itemsFailed: data.itemsFailed ?? 0,
    warningCount: data.warningCount ?? 0,
    errorCode: data.errorCode ?? null,
    message: data.message ?? null,
    attemptCount: data.attemptCount ?? 1,
  });
}

export async function getScanStages(scanId: string) {
  const db = getDb();
  return db.select().from(scanStages).where(eq(scanStages.scanId, scanId));
}

// ── Scan issues ────────────────────────────────────────────────────────────

export async function addScanIssue(data: {
  scanId: string;
  sourceFileId?: string;
  issueKind: string;
  severity?: string;
  message: string;
  details?: Record<string, unknown>;
}) {
  const db = getDb();
  await db.insert(scanIssues).values({
    scanId: data.scanId,
    sourceFileId: data.sourceFileId ?? null,
    issueKind: data.issueKind,
    severity: data.severity ?? 'warning',
    message: data.message,
    details: data.details ?? null,
  });
}

export async function getScanIssues(scanId: string) {
  const db = getDb();
  return db.select().from(scanIssues).where(eq(scanIssues.scanId, scanId));
}

// ── Aliases for route compatibility ───────────────────────────────────────

export const createScan = createP1Scan;
export const listScansForProject = listP1ScansForProject;
