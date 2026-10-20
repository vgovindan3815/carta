import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/programs/[name]/graph-only
 *
 * Runs ONLY the static deterministic parser (Phase 1) on the program's
 * source code, saves the dependency graph to the DB, and returns { jobId }.
 * No LLM chains are executed — fast and free.
 *
 * The client opens GET /api/jobs/[jobId] (SSE) to stream log lines.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { name } = await params;

  const {
    getProgram, getRepo, createJob, updateJob,
    saveProgramSource, saveDepGraph, appendJobLog,
    getProgramSource,
  } = await import('@/lib/db/queries');
  const { findProgramSource } = await import('@/lib/github');
  const { parseCobolFile } = await import('@/lib/parser/cobol');
  const { parseJclFile } = await import('@/lib/parser/jcl');
  const { decrypt } = await import('@/lib/crypto');

  const prog = await getProgram(name);
  if (!prog) return NextResponse.json({ error: 'Program not found' }, { status: 404 });

  const job = await createJob(prog.id);
  await updateJob(job.id, { status: 'running', phase: 'parsing', progressPct: 0, startedAt: new Date() });

  async function log(lv: string, t: string) {
    await appendJobLog(job.id, { lv, t, ts: Date.now() });
  }

  // Fire-and-forget — client streams via SSE
  (async () => {
    try {
      await log('INFO', `Starting static analysis of <span class="hl">${name}</span>…`);

      // Fetch source from GitHub (or fall back to stored source)
      let sourceText: string | undefined;
      let filename = `${name}.cbl`;

      if (prog.repoId) {
        const repo = await getRepo(prog.repoId);
        if (repo?.owner && repo?.repo) {
          const pat = repo.patEncrypted ? decrypt(repo.patEncrypted) : undefined;
          try {
            const fetched = await findProgramSource(
              repo.owner, repo.repo, repo.branch ?? 'main', name, pat
            );
            if (fetched) {
              sourceText = fetched;
              filename = prog.filePath ?? filename;
              await log('INFO', `Source fetched from GitHub — <span class="hl">${repo.owner}/${repo.repo}</span>`);
            }
          } catch (e) {
            await log('WARN', `GitHub fetch failed: ${String(e).slice(0, 120)} — trying stored source`);
          }
        }
      }

      if (!sourceText) {
        const stored = await getProgramSource(prog.id);
        if (stored?.sourceText) {
          sourceText = stored.sourceText;
          await log('INFO', 'Using stored source (GitHub not connected or unreachable)');
        }
      }

      if (!sourceText) {
        await updateJob(job.id, { status: 'failed', phase: 'error', error: 'No source available', completedAt: new Date() });
        await log('WARN', 'No source available — connect a GitHub repository to enable static analysis');
        return;
      }

      // Store / update source
      await saveProgramSource(prog.id, sourceText);

      // Run static parser
      const isJcl = /\.(jcl|proc)$/i.test(filename) ||
        (prog.language?.toUpperCase() === 'JCL') ||
        (/^\/\//.test(sourceText.trimStart()));

      const parsed = isJcl
        ? parseJclFile(filename, sourceText)
        : parseCobolFile(filename, sourceText);

      await log('INFO', `Language: <span class="hl">${parsed.language}</span> · LOC: <span class="hl">${parsed.loc.toLocaleString()}</span>`);

      const callEdges = parsed.graph.edges.filter((e) => e.type === 'call' || e.type === 'dyn');
      const sqlEdges  = parsed.graph.edges.filter((e) => e.type === 'data');
      const cicsEdges = parsed.graph.edges.filter((e) => e.type === 'cics');
      const copyEdges = parsed.graph.edges.filter((e) => e.type === 'copy');

      for (const e of callEdges) {
        const isDyn = e.type === 'dyn';
        await log(
          isDyn ? 'WARN' : 'CALL',
          `CALL <span class="hl">${e.to}</span>${isDyn ? ' <span class="dim">(dynamic, ~71% confidence)</span>' : ''}`
        );
      }
      for (const e of sqlEdges) {
        await log('SQL', `SQL → <span class="hl">${e.to}</span>${e.label ? ` <span class="dim">(${e.label})</span>` : ''}`);
      }
      for (const e of cicsEdges) {
        await log('DATA', `CICS → <span class="hl">${e.to}</span>${e.label ? ` <span class="dim">(${e.label})</span>` : ''}`);
      }
      for (const e of copyEdges) {
        await log('INFO', `COPY <span class="hl">${e.to}</span>`);
      }

      await log('INFO', `Graph: <span class="hl">${parsed.graph.nodes.length} nodes · ${parsed.graph.edges.length} edges</span> · Coverage: <span class="hl">${parsed.graph.coveragePct}%</span>`);

      // Save dep graph
      const cLayoutNodes = parsed.graph.nodes.filter((n) => n.cx !== undefined);
      await saveDepGraph(prog.id, job.id, {
        nodes: parsed.graph.nodes,
        edges: parsed.graph.edges,
        coveragePct: parsed.graph.coveragePct,
        cLayoutNodes: cLayoutNodes.length > 0 ? cLayoutNodes : undefined,
      });

      await updateJob(job.id, {
        status: 'completed',
        phase: 'done',
        progressPct: 100,
        completedAt: new Date(),
        tokensUsed: 0,
      });

      await log('DONE', `Static graph saved — <span class="hl">0 tokens used</span> · source: deterministic parser`);
    } catch (err) {
      await updateJob(job.id, { status: 'failed', phase: 'error', error: String(err), completedAt: new Date() });
      await appendJobLog(job.id, { lv: 'WARN', t: `Error: ${String(err).slice(0, 200)}`, ts: Date.now() });
    }
  })();

  return NextResponse.json({ jobId: job.id });
}
