import { NonRetriableError } from 'inngest';
import { inngest } from '../client';

const STAGE = {
  ACQUIRING_SOURCE: 'ACQUIRING_SOURCE',
  INVENTORYING_FILES: 'INVENTORYING_FILES',
  PARSING_SOURCE: 'PARSING_SOURCE',
  BUILDING_GRAPH: 'BUILDING_GRAPH',
  FINALIZING: 'FINALIZING',
} as const;

async function stageHelper(scanId: string, stageName: string, status: string, startedAt?: Date) {
  const { upsertScanStage } = await import('@/lib/db/queries');
  await upsertScanStage({ scanId, stageName, status, startedAt });
}

export const scanProjectFn = inngest.createFunction(
  {
    id: 'scan-project',
    name: 'Scan Project',
    retries: 2,
    triggers: [{ event: 'maven/scan.requested' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: { event: any; step: any }) => {
    const { scanId, projectId } = event.data as { scanId: string; projectId: string };

    // Stage 1: Acquire file list from GitHub
    const snapshot = await step.run('acquiring-source', async () => {
      const { updateP1Scan, upsertScanStage, getSourceConnectionsForProject, createSnapshot } =
        await import('@/lib/db/queries');
      const { decrypt } = await import('@/lib/crypto');
      const { listCobolFiles } = await import('@/lib/github');

      await updateP1Scan(scanId, { status: 'running' });
      await upsertScanStage({
        scanId, stageName: STAGE.ACQUIRING_SOURCE, status: 'running', startedAt: new Date(),
      });

      const connections = await getSourceConnectionsForProject(projectId);
      const conn = connections.find((c: { kind: string }) => c.kind === 'github');
      if (!conn?.owner || !conn?.repo) {
        await upsertScanStage({
          scanId, stageName: STAGE.ACQUIRING_SOURCE, status: 'failed',
          errorCode: 'NO_SOURCE_CONNECTION', completedAt: new Date(),
        });
        throw new NonRetriableError('No GitHub source connection found for project');
      }

      const pat = conn.patEncryptedRef ? decrypt(conn.patEncryptedRef) : undefined;
      const files = await listCobolFiles(conn.owner, conn.repo, conn.branch ?? 'main', pat);

      const snap = await createSnapshot({
        projectId,
        sourceConnectionId: conn.id,
        fileCount: files.length,
      });

      await upsertScanStage({
        scanId, stageName: STAGE.ACQUIRING_SOURCE, status: 'completed',
        itemsProcessed: files.length, completedAt: new Date(),
      });

      return {
        snapshotId: snap.id,
        files,
        owner: conn.owner as string,
        repo: conn.repo as string,
        branch: (conn.branch ?? 'main') as string,
        pat: pat as string | undefined,
      };
    });

    // Stage 2: Inventory files into source_files table
    await step.run('inventorying-files', async () => {
      const { upsertScanStage, upsertSourceFile, updateP1Scan } = await import('@/lib/db/queries');

      await upsertScanStage({
        scanId, stageName: STAGE.INVENTORYING_FILES, status: 'running', startedAt: new Date(),
      });
      await updateP1Scan(scanId, { snapshotId: snapshot.snapshotId });

      let processed = 0;
      for (const file of snapshot.files as Array<{ path: string; sha: string; language: string }>) {
        if (file.language === 'other') continue;
        await upsertSourceFile({
          snapshotId: snapshot.snapshotId,
          path: file.path,
          sha256: file.sha,
          language: file.language,
          languageConfidence: 90,
          classification:
            file.language === 'CPY' ? 'copybook'
            : file.language === 'JCL' || file.language === 'PROC' ? 'jcl'
            : 'program',
        });
        processed++;
      }

      await upsertScanStage({
        scanId, stageName: STAGE.INVENTORYING_FILES, status: 'completed',
        itemsProcessed: processed, completedAt: new Date(),
      });
    });

    // Stage 3: Parse files in batches of 25
    const sourceFileList = await step.run('get-source-files', async () => {
      const { getSourceFilesForSnapshot } = await import('@/lib/db/queries');
      return getSourceFilesForSnapshot(snapshot.snapshotId);
    });

    const BATCH_SIZE = 25;
    const parseable = (sourceFileList as Array<{ id: string; analysisStatus: string; path: string; language: string | null }>)
      .filter(f => f.analysisStatus === 'pending');

    await stageHelper(scanId, STAGE.PARSING_SOURCE, 'running', new Date());

    for (let i = 0; i < parseable.length; i += BATCH_SIZE) {
      const batch = parseable.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      await step.run(`parse-batch-${batchNum}`, async () => {
        const { updateSourceFileStatus, addScanIssue, upsertScanStage } =
          await import('@/lib/db/queries');
        const { fetchFileContent } = await import('@/lib/github');
        const { parseArtifact } = await import('@/lib/parser/registry');

        let processed = 0;
        let failed = 0;

        await Promise.all(
          batch.map(async (file) => {
            try {
              const content = await fetchFileContent(
                snapshot.owner, snapshot.repo, file.path, snapshot.branch, snapshot.pat,
              );
              const result = parseArtifact(file.path, content, file.language ?? undefined);

              await updateSourceFileStatus(file.id, 'parsed', {
                loc: result.loc,
                parserId: 'cobol-fixed',
                parserVersion: '1.0.0',
              });

              for (const issue of result.scanIssues ?? []) {
                await addScanIssue({
                  scanId,
                  sourceFileId: file.id,
                  issueKind: issue.kind,
                  severity: 'warning',
                  message: `${issue.kind}: ${issue.target}`,
                  details: { context: issue.context },
                });
              }

              processed++;
            } catch (err) {
              await updateSourceFileStatus(file.id, 'failed');
              await addScanIssue({
                scanId,
                sourceFileId: file.id,
                issueKind: 'parse_error',
                severity: 'error',
                message: String(err).slice(0, 500),
              });
              failed++;
            }
          }),
        );

        await upsertScanStage({
          scanId, stageName: STAGE.PARSING_SOURCE, status: 'running',
          itemsProcessed: i + processed,
          itemsFailed: failed,
        });
      });
    }

    await step.run('finalize-parse-stage', async () => {
      const { upsertScanStage } = await import('@/lib/db/queries');
      await upsertScanStage({
        scanId, stageName: STAGE.PARSING_SOURCE, status: 'completed',
        itemsProcessed: parseable.length, completedAt: new Date(),
      });
    });

    // Stage 4: Building graph — deferred to Phase 2
    await step.run('building-graph', async () => {
      const { upsertScanStage } = await import('@/lib/db/queries');
      await upsertScanStage({
        scanId, stageName: STAGE.BUILDING_GRAPH, status: 'skipped',
        message: 'Graph building deferred to Phase 2 KG integration',
        completedAt: new Date(),
      });
    });

    // Stage 5: Finalize
    await step.run('finalizing', async () => {
      const { updateP1Scan, upsertScanStage, getScanIssues } = await import('@/lib/db/queries');

      const issues = await getScanIssues(scanId);
      const errorCount = issues.filter((i: { severity: string }) => i.severity === 'error').length;
      const warnCount = issues.filter((i: { severity: string }) => i.severity === 'warning').length;

      const headlineStatus =
        errorCount > 0 ? `Completed with ${errorCount} errors, ${warnCount} warnings`
        : warnCount > 0 ? `Completed with ${warnCount} warnings`
        : 'Completed successfully';

      await updateP1Scan(scanId, {
        status: 'completed',
        headlineStatus,
        completedAt: new Date(),
      });

      await upsertScanStage({
        scanId, stageName: STAGE.FINALIZING, status: 'completed',
        message: headlineStatus, completedAt: new Date(),
      });
    });

    return { scanId, status: 'completed' };
  },
);
