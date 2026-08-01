import { NextRequest } from 'next/server';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 8;

function enc(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  const text = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(text));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  const { id: repoId, jobId } = await params;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Verify DB is available
        if (!process.env.DATABASE_URL) {
          enc(controller, 'error', { error: 'No database configured' });
          controller.close();
          return;
        }

        const { getRepo, getScanJob, updateScanJob, upsertProgram, saveCopybook } =
          await import('@/lib/db/queries');
        const { listCobolFiles, fetchFileContent } = await import('@/lib/github');
        const { parseCobolFile } = await import('@/lib/parser/cobol');
        const { parseJclFile } = await import('@/lib/parser/jcl');
        const { parseCopybook } = await import('@/lib/parser/copybook');

        // Load the repo record to get owner/repo/branch/pat
        const repo = await getRepo(repoId);
        if (!repo) {
          enc(controller, 'error', { error: 'Repo not found' });
          controller.close();
          return;
        }

        // Load scan job
        const scanJob = await getScanJob(jobId);
        if (!scanJob || scanJob.repoId !== repoId) {
          enc(controller, 'error', { error: 'Scan job not found' });
          controller.close();
          return;
        }

        const pat = repo.patEncrypted
          ? Buffer.from(repo.patEncrypted, 'base64').toString('utf-8')
          : undefined;

        await updateScanJob(jobId, { status: 'running' });

        // Phase A: list files from GitHub
        let files: Awaited<ReturnType<typeof listCobolFiles>>;
        try {
          files = await listCobolFiles(repo.owner, repo.repo, repo.branch, pat);
        } catch (e) {
          await updateScanJob(jobId, { status: 'failed', error: String(e), completedAt: new Date() });
          enc(controller, 'error', { error: `Failed to list repo files: ${e}` });
          controller.close();
          return;
        }

        const eligible = files.filter((f) => f.language !== 'other').slice(0, 100);
        await updateScanJob(jobId, { totalFiles: eligible.length });
        enc(controller, 'progress', { done: 0, total: eligible.length });

        // Phase B: fetch + parse + upsert in parallel batches of BATCH_SIZE
        let done = 0;
        for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
          const batch = eligible.slice(i, i + BATCH_SIZE);

          await Promise.all(
            batch.map(async (file) => {
              try {
                const content = await fetchFileContent(
                  repo.owner,
                  repo.repo,
                  file.path,
                  repo.branch,
                  pat
                );

                // Handle copybooks separately
                if (file.language === 'CPY') {
                  const cbName =
                    file.path.split('/').pop()?.replace(/\.cpy$/i, '').toUpperCase() ?? file.path;
                  try {
                    const cbDef = parseCopybook(cbName, content);
                    await saveCopybook(repoId, cbDef.name, cbDef.source, cbDef.fields);
                  } catch {
                    // skip malformed copybooks
                  }
                  return;
                }

                let name =
                  file.path
                    .split('/')
                    .pop()
                    ?.replace(/\.(cbl|cob|cobol|asm|hlasm|jcl|proc)$/i, '')
                    .toUpperCase() ?? file.path;
                let loc = content.split('\n').length;
                const language: string =
                  file.language === 'HLASM'
                    ? 'HLASM'
                    : file.language === 'JCL'
                    ? 'JCL'
                    : file.language === 'PROC'
                    ? 'PROC'
                    : 'COBOL';

                try {
                  if (file.language === 'COBOL' || file.language === 'HLASM') {
                    const parsed = parseCobolFile(file.path, content);
                    name = parsed.name || name;
                    loc = parsed.loc || loc;
                  } else if (file.language === 'JCL' || file.language === 'PROC') {
                    const parsed = parseJclFile(file.path, content);
                    name = parsed.name || name;
                    loc = parsed.loc || loc;
                  }
                } catch {
                  // use defaults
                }

                await upsertProgram({
                  repoId,
                  name,
                  language,
                  loc,
                  domain: 'General',
                  desc: `${language} program`,
                  filePath: file.path,
                  lastCommitSha: file.sha,
                });
              } catch {
                // skip files that fail to fetch/parse
              }
            })
          );

          done = Math.min(done + batch.length, eligible.length);
          await updateScanJob(jobId, { scannedFiles: done });
          enc(controller, 'progress', { done, total: eligible.length });
        }

        await updateScanJob(jobId, {
          status: 'completed',
          scannedFiles: eligible.length,
          completedAt: new Date(),
        });
        enc(controller, 'done', { programCount: eligible.length });
      } catch (err) {
        try {
          const { updateScanJob } = await import('@/lib/db/queries');
          await updateScanJob(jobId, { status: 'failed', error: String(err), completedAt: new Date() });
        } catch { /* ignore */ }
        enc(controller, 'error', { error: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
