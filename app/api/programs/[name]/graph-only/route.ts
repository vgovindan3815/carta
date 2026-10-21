import { NextRequest } from 'next/server';

/**
 * POST /api/programs/[name]/graph-only  (preferred)
 * GET  /api/programs/[name]/graph-only  (deprecated shim — kept for EventSource compatibility)
 *
 * Self-contained SSE stream that runs ONLY the static deterministic parser.
 * No LLM is called. The dep graph is saved and a 'done' event is emitted when complete.
 *
 * TODO 0.5: migrate clients to POST+events pattern (job queue) in Phase 1.
 * EventSource only supports GET, so full migration requires a separate GET /events route.
 */

function buildStream(name: string): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      function emit(event: string, data: object) {
        const evtLine = event !== 'message' ? `event: ${event}\n` : '';
        controller.enqueue(enc.encode(`${evtLine}data: ${JSON.stringify(data)}\n\n`));
      }

      function log(lv: string, t: string) {
        emit('message', { lv, t });
      }

      try {
        if (!process.env.DATABASE_URL) {
          emit('done', {});
          controller.close();
          return;
        }

        const {
          getProgram, getRepo, saveDepGraph, saveProgramSource, getProgramSource, createJob, updateJob, appendJobLog,
        } = await import('@/lib/db/queries');
        const { parseCobolFile } = await import('@/lib/parser/cobol');
        const { parseJclFile } = await import('@/lib/parser/jcl');
        const { parsePliFile } = await import('@/lib/parser/pli');
        const { fetchFileContent, findProgramSource } = await import('@/lib/github');
        const { decrypt } = await import('@/lib/crypto');

        const prog = await getProgram(name);
        if (!prog) {
          emit('error', { error: `Program ${name} not found` });
          controller.close();
          return;
        }

        // Create a job record so the dep graph has a valid jobId FK
        const job = await createJob(prog.id);
        await updateJob(job.id, { status: 'running', phase: 'parsing', progressPct: 0, startedAt: new Date() });

        async function persist(lv: string, t: string) {
          log(lv, t);
          try { await appendJobLog(job.id, { lv, t, ts: Date.now() }); } catch { /* non-fatal */ }
        }

        await persist('INFO', `Starting static analysis of <span class="hl">${name}</span>…`);

        // Fetch source from GitHub
        let sourceText: string | undefined;
        let filename = prog.filePath ?? `${name}.cbl`;

        if (prog.repoId) {
          const repo = await getRepo(prog.repoId);
          if (repo?.owner && repo?.repo && !repo.githubUrl.startsWith('cast://') && !repo.githubUrl.startsWith('upload://')) {
            const pat = repo.patEncrypted ? decrypt(repo.patEncrypted) : undefined;
            try {
              if (prog.filePath) {
                sourceText = await fetchFileContent(repo.owner, repo.repo, prog.filePath, repo.branch ?? 'main', pat);
                filename = prog.filePath;
              } else {
                const fetched = await findProgramSource(repo.owner, repo.repo, repo.branch ?? 'main', name, pat);
                if (fetched) sourceText = fetched;
              }
              if (sourceText) {
                await persist('INFO', `Source fetched from <span class="hl">${repo.owner}/${repo.repo}</span>`);
              }
            } catch (e) {
              await persist('WARN', `GitHub fetch failed: ${String(e).slice(0, 100)} — trying stored source`);
            }
          }
        }

        if (!sourceText) {
          const stored = await getProgramSource(prog.id);
          if (stored?.sourceText) {
            sourceText = stored.sourceText;
            await persist('INFO', 'Using stored source');
          }
        }

        if (!sourceText) {
          await updateJob(job.id, { status: 'failed', phase: 'error', error: 'No source available', completedAt: new Date() });
          emit('error', { error: 'No source available — connect a GitHub repository first' });
          controller.close();
          return;
        }

        // Store source
        await saveProgramSource(prog.id, sourceText);

        // Run static parser
        const isPli = /\.(pl1|pli)$/i.test(filename) ||
          prog.language?.toUpperCase() === 'PLI' ||
          /^\s*\w+\s*:\s*(?:PROCEDURE|PROC)\b/i.test(sourceText.slice(0, 500));
        const isJcl = !isPli && (
          /\.(jcl|proc)$/i.test(filename) ||
          prog.language?.toUpperCase() === 'JCL' || prog.language?.toUpperCase() === 'PROC' ||
          /^\/\//.test(sourceText.trimStart())
        );

        const parsed = isPli
          ? parsePliFile(filename, sourceText)
          : isJcl
          ? parseJclFile(filename, sourceText)
          : parseCobolFile(filename, sourceText);

        await persist('INFO', `Language: <span class="hl">${parsed.language}</span> · LOC: <span class="hl">${parsed.loc.toLocaleString()}</span>`);

        for (const e of parsed.graph.edges) {
          if (e.type === 'call') await persist('CALL', `CALL <span class="hl">${e.to}</span>`);
          else if (e.type === 'dyn') await persist('WARN', `CALL <span class="hl">${e.to}</span> <span class="dim">(dynamic, ~71% confidence)</span>`);
          else if (e.type === 'data') await persist('SQL', `${e.label ?? 'DATA'} → <span class="hl">${e.to}</span>`);
          else if (e.type === 'cics') await persist('DATA', `CICS → <span class="hl">${e.to}</span>${e.label ? ` <span class="dim">(${e.label})</span>` : ''}`);
          else if (e.type === 'copy') await persist('INFO', `COPY <span class="hl">${e.to}</span>`);
        }

        await persist('INFO', `Graph: <span class="hl">${parsed.graph.nodes.length} nodes · ${parsed.graph.edges.length} edges</span> · Coverage: <span class="hl">${parsed.graph.coveragePct}%</span>`);

        if (parsed.internalFlow) {
          await persist('INFO', `Paragraphs: <span class="hl">${parsed.internalFlow.paragraphs.length}</span> · PERFORM edges: <span class="hl">${parsed.internalFlow.performEdges.length}</span>`);
        }

        const cLayoutNodes = parsed.graph.nodes.filter((n) => n.cx !== undefined);
        await saveDepGraph(prog.id, job.id, {
          nodes: parsed.graph.nodes,
          edges: parsed.graph.edges,
          coveragePct: parsed.graph.coveragePct,
          cLayoutNodes: cLayoutNodes.length > 0 ? cLayoutNodes : undefined,
          internalFlow: parsed.internalFlow,
        });

        await updateJob(job.id, { status: 'completed', phase: 'done', progressPct: 100, completedAt: new Date(), tokensUsed: 0 });
        await persist('DONE', `Static graph saved — <span class="hl">0 tokens used</span> · source: deterministic parser`);

        emit('done', {});
      } catch (err) {
        emit('error', { error: String(err) });
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

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  return buildStream(name);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  console.warn(`[DEPRECATED] GET /api/programs/${name}/graph-only — use POST instead`);
  return buildStream(name);
}
