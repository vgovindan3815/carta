import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/programs/[name]/staleness
 * Returns whether the stored source is stale relative to the last GitHub commit.
 * Response: { isStale: boolean, lastAnalyzedAt: string | null, currentCommitSha: string | null, storedCommitSha: string | null }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ isStale: false, lastAnalyzedAt: null, currentCommitSha: null, storedCommitSha: null });
  }

  const { name } = await params;

  try {
    const { getProgram, getRepo, getProgramSource } = await import('@/lib/db/queries');
    const prog = await getProgram(name);
    if (!prog) return NextResponse.json({ isStale: false, lastAnalyzedAt: null, currentCommitSha: null, storedCommitSha: null });

    const lastAnalyzedAt = prog.lastAnalyzedAt?.toISOString() ?? null;
    const storedSource = await getProgramSource(prog.id);
    const storedCommitSha = storedSource?.commitSha ?? null;

    // Compare stored commit SHA with what's currently in GitHub
    let currentCommitSha: string | null = null;
    let isStale = false;

    if (prog.repoId) {
      try {
        const repo = await getRepo(prog.repoId);
        if (repo?.owner && repo?.repo && repo?.githubUrl?.startsWith('https://github.com')) {
          const { decrypt } = await import('@/lib/crypto');
          const pat = repo.patEncrypted ? decrypt(repo.patEncrypted) : undefined;
          const { getLatestCommitSha } = await import('@/lib/github');
          currentCommitSha = await getLatestCommitSha(
            repo.owner, repo.repo, repo.branch ?? 'main',
            prog.filePath ?? `${name}.cbl`, pat
          );
          if (currentCommitSha && storedCommitSha && currentCommitSha !== storedCommitSha) {
            isStale = true;
          } else if (currentCommitSha && !storedCommitSha) {
            isStale = true;
          }
        }
      } catch {
        // Non-fatal — GitHub unreachable, assume not stale
      }
    }

    return NextResponse.json({ isStale, lastAnalyzedAt, currentCommitSha, storedCommitSha });
  } catch {
    return NextResponse.json({ isStale: false, lastAnalyzedAt: null, currentCommitSha: null, storedCommitSha: null });
  }
}
