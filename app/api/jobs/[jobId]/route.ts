import { NextRequest } from 'next/server';

export const maxDuration = 300; // 5 min timeout on Vercel

/** Escape HTML special characters to prevent XSS in log messages rendered via dangerouslySetInnerHTML */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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
          { resolveApiConfig },
        ] = await Promise.all([
          import('@/lib/db/queries'),
          import('@/lib/github'),
          import('@/lib/llm/resolveKey'),
        ]);

        const apiConfig = await resolveApiConfig(_req);
        if (!apiConfig) {
          emit({ error: 'needs_api_key', message: 'No LLM key configured.' }, 'error');
          controller.close();
          return;
        }
        const llmConfig = { provider: apiConfig.provider, apiKey: apiConfig.apiKey };

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

        const allProgs = await listPrograms(prog.repoId);
        const allNames = allProgs.map((p) => p.name);

        // 5. Try to fetch source from GitHub; fall back to stored source for local repos
        const isLocalRepo =
          repo.githubUrl.startsWith('cast://') || repo.githubUrl.startsWith('upload://');
        let source: string | null = null;

        if (repo.githubUrl.startsWith('upload://')) {
          // Source was stored at upload time — load it from DB
          const { getProgramSource } = await import('@/lib/db/queries');
          const srcRow = await getProgramSource(prog.id);
          source = srcRow?.sourceText ?? null;
          if (!source) {
            emit({ lv: 'WARN', t: `No stored source found for ${esc(prog.name)}.` });
          }
        }

        if (!isLocalRepo) {
          const { decrypt } = await import('@/lib/crypto');
          const { findProgramSource, getDefaultBranch } = await import('@/lib/github');
          const pat = repo.patEncrypted ? decrypt(repo.patEncrypted) : undefined;

          // Stored branch may be "main" while the repo uses "master" — auto-correct on failure
          let branch = repo.branch ?? 'main';
          emit({ lv: 'INFO', t: `Fetching ${esc(prog.filePath)} from ${esc(repo.owner)}/${esc(repo.repo)} (${esc(branch)})…` });

          try {
            source = await fetchFileContent(repo.owner, repo.repo, prog.filePath, branch, pat);
          } catch {
            // Branch or path wrong — try the repo's actual default branch
            try {
              const defaultBranch = await getDefaultBranch(repo.owner, repo.repo, pat);
              if (defaultBranch !== branch) {
                branch = defaultBranch;
                emit({ lv: 'WARN', t: `Retrying with default branch "${esc(branch)}"…` });
                source = await fetchFileContent(repo.owner, repo.repo, prog.filePath, branch, pat);
              }
            } catch { /* fall through */ }

            if (!source) {
              // Path still wrong — search the whole repo tree by program name
              emit({ lv: 'WARN', t: `Searching repo for ${esc(prog.name)}…` });
              source = await findProgramSource(repo.owner, repo.repo, branch, prog.name, pat);
              if (source) {
                emit({ lv: 'INFO', t: `Found ${esc(prog.name)} via name search.` });
              }
            }
          }
        }

        const { runAnalysisPipeline: runFull, runCastLLMPipeline } = await import('@/lib/analysis/orchestrate');

        if (source) {
          await runFull(
            jobId,
            prog.id,
            prog.name,
            source,
            prog.filePath,
            allNames,
            (line) => emit(line),
            llmConfig
          );
        } else if (repo.githubUrl.startsWith('cast://')) {
          // CAST import — no source file; rely on the pre-built dep graph from the CAST report
          await runCastLLMPipeline(
            jobId,
            prog.id,
            prog.name,
            allNames,
            (line) => emit(line),
            llmConfig
          );
        } else {
          // GitHub or upload repo — source was unavailable (fetch failed or not stored yet)
          const why = repo.githubUrl.startsWith('upload://')
            ? `No source stored for ${esc(prog.name)}. Re-upload the source file to re-run analysis.`
            : `Could not fetch ${esc(prog.filePath)} from ${esc(repo.owner)}/${esc(repo.repo)}. Check that the file path and branch are correct, and that your GitHub PAT has read access to this repository.`;
          emit({ lv: 'ERROR', t: `✕ ${why}` });
          await updateJob(jobId, { status: 'failed', error: why, completedAt: new Date() });
          emit({}, 'done');
          return;
        }

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
