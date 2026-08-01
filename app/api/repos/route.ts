import { NextRequest, NextResponse } from 'next/server';

// Dynamic import guards — if DB is not configured, routes degrade gracefully
async function tryGetDb() {
  try {
    if (!process.env.DATABASE_URL) return null;
    const { createRepo, listRepos, createScanJob } = await import('@/lib/db/queries');
    return { createRepo, listRepos, createScanJob };
  } catch {
    return null;
  }
}

async function tryGetGithub() {
  try {
    const { parseGithubUrl } = await import('@/lib/github');
    return { parseGithubUrl };
  } catch {
    return null;
  }
}

// GET /api/repos — list all connected repos
export async function GET() {
  const db = await tryGetDb();
  if (!db) {
    return NextResponse.json([], { status: 200 });
  }
  try {
    const repos = await db.listRepos();
    return NextResponse.json(repos);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/repos — connect a new GitHub repo and kick off async scanning
// Returns immediately with { repoId, scanJobId } — actual scanning is done via SSE
export async function POST(req: NextRequest) {
  let body: { githubUrl?: string; pat?: string; projectName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { githubUrl, pat, projectName } = body;
  if (!githubUrl) {
    return NextResponse.json({ error: 'githubUrl is required' }, { status: 400 });
  }

  const gh = await tryGetGithub();
  if (!gh) {
    return NextResponse.json({ error: 'GitHub integration not available' }, { status: 503 });
  }

  // 1. Parse URL → owner/repo
  let parsed: { owner: string; repo: string; branch: string };
  try {
    const result = await gh.parseGithubUrl(githubUrl);
    if (!result) throw new Error('Could not parse GitHub URL');
    parsed = { ...result, branch: 'main' };
  } catch (e) {
    return NextResponse.json({ error: `Invalid GitHub URL: ${e}` }, { status: 400 });
  }

  const db = await tryGetDb();

  // 2. Create (or update) repo record in DB
  let repoId: string | null = null;
  if (db) {
    try {
      const repoRecord = await db.createRepo({
        projectName: projectName || parsed.repo,
        githubUrl,
        owner: parsed.owner,
        repo: parsed.repo,
        branch: parsed.branch,
        patEncrypted: pat ? Buffer.from(pat).toString('base64') : undefined,
      });
      repoId = repoRecord.id;
    } catch (e) {
      return NextResponse.json({ error: `Failed to save repo: ${e}` }, { status: 500 });
    }

    // 3. Create a scan job — scanning happens asynchronously via SSE
    try {
      const scanJob = await db.createScanJob(repoId!);
      return NextResponse.json({ repoId, scanJobId: scanJob.id });
    } catch (e) {
      return NextResponse.json({ error: `Failed to create scan job: ${e}` }, { status: 500 });
    }
  }

  // Fallback (no DB): return minimal info
  return NextResponse.json({ repoId: null, scanJobId: null });
}
