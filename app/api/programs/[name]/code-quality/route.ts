import { NextRequest, NextResponse } from 'next/server';

/**
 * GET  /api/programs/[name]/code-quality
 *   Returns the cached CodeQualityAnalysis from the most-recent dep_graph row, or null.
 *
 * POST /api/programs/[name]/code-quality
 *   Runs the LLM code-quality analysis and stores the result.
 *   Body: { force?: boolean }  — if false and cached data exists, returns cached data without LLM call.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  if (!process.env.DATABASE_URL) return NextResponse.json(null);

  try {
    const { getMostRecentDepGraph } = await import('@/lib/db/knowledge');
    const { getProgram } = await import('@/lib/db/queries');
    // getProgram is in queries; other imports only needed for POST

    const prog = await getProgram(name);
    if (!prog) return NextResponse.json(null, { status: 404 });

    const depGraph = await getMostRecentDepGraph(prog.id);
    const flow = depGraph?.internalFlow as { codeQuality?: unknown } | null;
    return NextResponse.json(flow?.codeQuality ?? null);
  } catch (e) {
    console.error('[code-quality GET]', e);
    return NextResponse.json(null, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'No database configured' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const force = body?.force === true;

  try {
    const { getMostRecentDepGraph, updateDepGraphCodeQuality } = await import('@/lib/db/knowledge');
    const { getProgram } = await import('@/lib/db/queries');
    const { getProgramSource } = await import('@/lib/db/programs');
    const { getRepo } = await import('@/lib/db/projects');
    const { getLLMSettings } = await import('@/lib/db/settings');

    const prog = await getProgram(name);
    if (!prog) return NextResponse.json({ error: 'Program not found' }, { status: 404 });

    const depGraph = await getMostRecentDepGraph(prog.id);
    if (!depGraph) return NextResponse.json({ error: 'No dependency graph found — run Build Graph first' }, { status: 400 });

    // Return cached result if not forcing a refresh
    const existingFlow = depGraph.internalFlow as { codeQuality?: unknown } | null;
    if (!force && existingFlow?.codeQuality) {
      return NextResponse.json(existingFlow.codeQuality);
    }

    // Fetch source
    let source: string | null = null;

    if (prog.repoId) {
      const repo = await getRepo(prog.repoId);
      if (repo?.owner && repo?.repo && !repo.githubUrl.startsWith('cast://') && !repo.githubUrl.startsWith('upload://')) {
        try {
          const { fetchFileContent, findProgramSource } = await import('@/lib/github');
          const { decrypt } = await import('@/lib/crypto');
          const pat = repo.patEncrypted ? decrypt(repo.patEncrypted) : undefined;
          if (prog.filePath) {
            source = await fetchFileContent(repo.owner, repo.repo, prog.filePath, repo.branch ?? 'main', pat);
          } else {
            source = await findProgramSource(repo.owner, repo.repo, repo.branch ?? 'main', name, pat) ?? null;
          }
        } catch { /* fall through to stored source */ }
      }
    }

    if (!source) {
      const stored = await getProgramSource(prog.id);
      source = stored?.sourceText ?? null;
    }

    if (!source) return NextResponse.json({ error: 'No source available — connect a GitHub repository or upload source' }, { status: 400 });

    // Run LLM analysis
    const llmConfig = await getLLMSettings();
    const { createLLMProvider } = await import('@/lib/llm');
    const chains = createLLMProvider(llmConfig);
    const { quality, tokensUsed } = await chains.generateCodeQuality(source, name, prog.language ?? 'COBOL');

    // Persist result
    await updateDepGraphCodeQuality(depGraph.id, quality);

    return NextResponse.json({ ...quality, tokensUsed });
  } catch (e) {
    console.error('[code-quality POST]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
