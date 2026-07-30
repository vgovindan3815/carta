import { NextRequest, NextResponse } from 'next/server';

// GET /api/programs — list all programs (optionally filtered by repoId)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const repoId = searchParams.get('repoId') ?? undefined;

  if (!process.env.DATABASE_URL) {
    const { PROGRAMS } = await import('@/lib/demo-data');
    const demo = Object.values(PROGRAMS).map((p) => ({
      name: p.name,
      language: p.language,
      loc: p.loc,
      domain: p.domain,
      desc: p.desc,
      status: 'analyzed',
      lastAnalyzedAt: new Date().toISOString(),
    }));
    return NextResponse.json(demo);
  }

  try {
    const { listPrograms } = await import('@/lib/db/queries');
    const rows = await listPrograms(repoId);
    const result = rows.map((r) => ({
      name: r.name,
      language: r.language,
      loc: r.loc,
      domain: r.domain ?? 'Unknown',
      desc: r.desc ?? '',
      status: r.lastAnalyzedAt ? 'analyzed' : 'not_analyzed',
      lastAnalyzedAt: r.lastAnalyzedAt ? r.lastAnalyzedAt.toISOString() : null,
    }));
    return NextResponse.json(result);
  } catch (e) {
    console.error('[/api/programs GET]', e);
    return NextResponse.json([], { status: 200 });
  }
}
