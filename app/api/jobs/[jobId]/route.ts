import { NextRequest } from 'next/server';

export const maxDuration = 300; // 5 min timeout on Vercel

// GET /api/jobs/[jobId] — SSE endpoint that runs the analysis pipeline and streams log lines
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!process.env.DATABASE_URL) {
    // No DB — immediately emit done so UI falls back to demo simulation
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode('event: done\ndata: {}\n\n'));
        controller.close();
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

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (data: object, event?: string) => {
        const evtLine = event ? `event: ${event}\n` : '';
        controller.enqueue(enc.encode(`${evtLine}data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Load dependencies lazily so module errors don't break the SSE response
        const [
          { getJob, getProgramById, getRepo, updateJob, listPrograms },
          { fetchFileContent },
          { runAnalysisPipeline },
        ] = await Promise.all([
          import('@/lib/db/queries'),
          import('@/lib/github'),
          import('@/lib/analysis/orchestrate'),
        ]);

        // 1. Look up job
        const job = await getJob(jobId);
        if (!job) {
          emit({ error: `Job ${jobId} not found` }, 'error');
          controller.close();
          return;
        }

        // 2. Look up program (by UUID from the job record)
        const prog = await getProgramById(job.programId);
        if (!prog) {
          emit({ error: 'Program not found' }, 'error');
          controller.close();
          return;
        }

        // 3. Look up repo
        const repo = await getRepo(prog.repoId);
        if (!repo) {
          emit({ error: 'Repository not found' }, 'error');
          controller.close();
          return;
        }

        // 4. Mark job as running
        await updateJob(jobId, { status: 'running', startedAt: new Date() });

        // 5. Fetch source from GitHub
        const pat = repo.patEncrypted
          ? Buffer.from(repo.patEncrypted, 'base64').toString('utf-8')
          : undefined;

        emit({ lv: 'INFO', t: `Fetching ${prog.filePath} from ${repo.owner}/${repo.repo}…` });

        const source = await fetchFileContent(
          repo.owner,
          repo.repo,
          prog.filePath,
          repo.branch,
          pat
        );

        // 6. Get all other program names in the repo for call-graph resolution
        const allProgs = await listPrograms(prog.repoId);
        const allNames = allProgs.map((p) => p.name);

        // 7. Run analysis pipeline — streams log lines back via callback
        await runAnalysisPipeline(
          jobId,
          prog.id,
          prog.name,
          source,
          prog.filePath,
          allNames,
          (line) => emit(line)
        );

        // 8. Mark job done
        await updateJob(jobId, { status: 'completed', completedAt: new Date() });

        emit({}, 'done');
      } catch (e) {
        console.error('[/api/jobs SSE]', e);
        emit({ error: String(e) }, 'error');
        // Try to mark job as failed
        try {
          const { updateJob } = await import('@/lib/db/queries');
          await updateJob(jobId, { status: 'failed', error: String(e) });
        } catch {}
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
