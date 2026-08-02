import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/programs/[name]/refresh
 * Body: { artifact: 'spec' | 'rules' | 'impact' | 'all' }
 *
 * Creates a new analysis job that runs only the requested LLM chain(s),
 * reusing the most recent dep graph from the DB. Returns { jobId } for
 * the client to open an SSE connection to /api/jobs/[jobId].
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { name } = await params;
  let body: { artifact?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }
  const artifact = body.artifact ?? 'all';

  const {
    getProgram, createJob, updateJob, getLLMSettings, listPrograms,
    getMostRecentDepGraph, saveBizRules, saveChangeImpact, saveModSpec,
    getCopybooksByNames, getJclCallers,
  } = await import('@/lib/db/queries');
  const { buildPortfolioContext } = await import('@/lib/context/portfolio');
  const { matchGlossary } = await import('@/lib/context/glossary');
  const { formatCopybookContext } = await import('@/lib/parser/copybook');
  const { createLLMProvider } = await import('@/lib/llm/index');

  const prog = await getProgram(name);
  if (!prog) return NextResponse.json({ error: 'Program not found' }, { status: 404 });

  const depGraph = await getMostRecentDepGraph(prog.id);
  if (!depGraph) return NextResponse.json({ error: 'No dep graph — run full analysis first' }, { status: 400 });

  const job = await createJob(prog.id);
  await updateJob(job.id, { status: 'running', phase: 'refresh', progressPct: 0, startedAt: new Date() });

  const llmSettings = await getLLMSettings();
  const { generateBusinessRules, generateChangeImpact, generateModSpec } = createLLMProvider({
    provider: llmSettings.provider, apiKey: llmSettings.apiKey,
  });

  // Build the ParsedCobolProgram shell from the stored dep graph
  const { GraphNode: _GN, GraphEdge: _GE } = { GraphNode: null, GraphEdge: null };
  void _GN; void _GE;
  const parsedShell = {
    name: prog.name,
    language: (prog.language as 'COBOL' | 'HLASM'),
    loc: prog.loc ?? 0,
    source: `* Refresh — no source stored. LOC: ${prog.loc ?? 0}`,
    graph: {
      nodes: depGraph.nodes as Parameters<typeof saveBizRules>[2] extends never ? never : any,
      edges: depGraph.edges as any,
      coveragePct: depGraph.coveragePct ?? 100,
    },
  };

  const repoId = prog.repoId ?? '';
  const allProgs = await listPrograms(prog.repoId);
  const allNames = allProgs.map((p) => p.name);

  // Context assembly
  const copyNames = (depGraph.edges as any[]).filter((e: any) => e.type === 'copy').map((e: any) => e.to as string);
  let copybookCtx = '';
  let glossaryCtx = '';
  let jclCallers: string[] = [];
  let portfolioCtx = '';

  try {
    if (copyNames.length) {
      const cbDefs = await getCopybooksByNames(repoId, copyNames);
      copybookCtx = formatCopybookContext(cbDefs);
    }
    glossaryCtx = await matchGlossary(repoId, [prog.name, ...copyNames]);
    jclCallers = await getJclCallers(prog.name, repoId);
    const calleeNames = (depGraph.edges as any[])
      .filter((e: any) => e.type === 'call' || e.type === 'dyn').map((e: any) => e.to as string);
    const { text } = await buildPortfolioContext(prog.id, repoId, calleeNames);
    portfolioCtx = text;
  } catch { /* non-fatal */ }

  let tokensUsed = 0;

  // Run the job async — fire and forget; client streams via /api/jobs/[jobId]
  (async () => {
    try {
      let businessRulesSections: any = null;

      if (artifact === 'rules' || artifact === 'all') {
        for await (const event of generateBusinessRules(parsedShell as any, copybookCtx || undefined, glossaryCtx || undefined, jclCallers.length ? jclCallers : undefined)) {
          if ('done' in event && event.done) {
            businessRulesSections = event.sections;
            tokensUsed += event.tokensUsed;
            await saveBizRules(prog.id, job.id, event.sections);
          }
        }
      }

      if (artifact === 'impact' || artifact === 'all') {
        for await (const event of generateChangeImpact(parsedShell as any, allNames, jclCallers.length ? jclCallers : undefined)) {
          if ('done' in event && event.done) {
            tokensUsed += event.tokensUsed;
            await saveChangeImpact(prog.id, job.id, event.impact);
          }
        }
      }

      if (artifact === 'spec' || artifact === 'all') {
        for await (const event of generateModSpec(parsedShell as any, businessRulesSections ?? [], portfolioCtx || undefined, copybookCtx || undefined)) {
          if ('done' in event && event.done) {
            tokensUsed += event.tokensUsed;
            await saveModSpec(prog.id, job.id, event.sections);
          }
        }
      }

      await updateJob(job.id, { status: 'completed', phase: 'done', progressPct: 100, completedAt: new Date(), tokensUsed });
    } catch (err) {
      await updateJob(job.id, { status: 'failed', phase: 'error', error: String(err), completedAt: new Date() });
    }
  })();

  return NextResponse.json({ jobId: job.id });
}
