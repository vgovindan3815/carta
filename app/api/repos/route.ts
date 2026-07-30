import { NextRequest, NextResponse } from 'next/server';

// Dynamic import guards — if DB is not configured, routes degrade gracefully
async function tryGetDb() {
  try {
    if (!process.env.DATABASE_URL) return null;
    const { createRepo, upsertProgram, listRepos } = await import('@/lib/db/queries');
    return { createRepo, upsertProgram, listRepos };
  } catch {
    return null;
  }
}

async function tryGetGithub() {
  try {
    const { parseGithubUrl, listCobolFiles, fetchFileContent, getLatestCommitSha } =
      await import('@/lib/github');
    return { parseGithubUrl, listCobolFiles, fetchFileContent, getLatestCommitSha };
  } catch {
    return null;
  }
}

async function tryGetParser() {
  try {
    const { parseCobolFile } = await import('@/lib/parser/cobol');
    return { parseCobolFile };
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

// POST /api/repos — connect a new GitHub repo and scan it
export async function POST(req: NextRequest) {
  let body: { githubUrl?: string; pat?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { githubUrl, pat } = body;
  if (!githubUrl) {
    return NextResponse.json({ error: 'githubUrl is required' }, { status: 400 });
  }

  const gh = await tryGetGithub();
  if (!gh) {
    return NextResponse.json(
      { error: 'GitHub integration not available' },
      { status: 503 }
    );
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

  // 2. List COBOL/HLASM files from GitHub
  let files: Awaited<ReturnType<typeof gh.listCobolFiles>>;
  try {
    files = await gh.listCobolFiles(parsed.owner, parsed.repo, parsed.branch, pat);
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to list repository files: ${e}` },
      { status: 502 }
    );
  }

  const db = await tryGetDb();
  const parser = await tryGetParser();

  let repoRecord: { id: string } | null = null;

  if (db) {
    // 3. Create repo record in DB
    try {
      repoRecord = await db.createRepo({
        githubUrl,
        owner: parsed.owner,
        repo: parsed.repo,
        branch: parsed.branch,
        patEncrypted: pat ? Buffer.from(pat).toString('base64') : undefined,
      });
    } catch (e) {
      return NextResponse.json({ error: `Failed to save repo: ${e}` }, { status: 500 });
    }
  }

  // 4. For each COBOL/HLASM file: fetch content, parse, upsert program
  const programResults: { name: string; language: string; loc: number; filePath: string }[] = [];

  for (const file of files.filter((f) => f.language !== 'other').slice(0, 50)) {
    try {
      const content = await gh.fetchFileContent(
        parsed.owner,
        parsed.repo,
        file.path,
        parsed.branch,
        pat
      );

      let name = file.path.split('/').pop()?.replace(/\.(cbl|cob|cobol|asm|hlasm|cpy)$/i, '').toUpperCase() ?? file.path;
      let loc = content.split('\n').length;
      let language: 'COBOL' | 'HLASM' = file.language === 'HLASM' ? 'HLASM' : 'COBOL';
      let domain = 'General';

      // Parse COBOL for better metadata
      if (parser && file.language === 'COBOL') {
        try {
          const parsed_prog = parser.parseCobolFile(file.path, content);
          name = parsed_prog.name || name;
          loc = parsed_prog.loc || loc;
        } catch {
          // use defaults
        }
      }

      if (db && repoRecord) {
        await db.upsertProgram({
          repoId: repoRecord.id,
          name,
          language,
          loc,
          domain,
          desc: `${language} program`,
          filePath: file.path,
          lastCommitSha: file.sha,
        });
      }

      programResults.push({ name, language, loc, filePath: file.path });
    } catch {
      // Skip files that fail to fetch/parse
    }
  }

  return NextResponse.json({
    repoId: repoRecord?.id ?? null,
    programCount: programResults.length,
    programs: programResults,
  });
}
