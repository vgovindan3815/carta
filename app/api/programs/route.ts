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
      status: 'documented' as const,
      docStatus: 'documented' as const,
      lastAnalyzedAt: new Date().toISOString(),
    }));
    return NextResponse.json(demo);
  }

  try {
    const { listPrograms, getDocStatusForPrograms } = await import('@/lib/db/queries');
    const rows = await listPrograms(repoId);
    const ids = rows.map((r) => r.id);
    const docStatuses = ids.length > 0 ? await getDocStatusForPrograms(ids) : {};

    const result = rows.map((r) => {
      const ds = docStatuses[r.id] ?? 'not_analyzed';
      return {
        name: r.name,
        language: r.language,
        loc: r.loc,
        domain: r.domain ?? 'Unknown',
        desc: r.desc ?? '',
        status: ds === 'documented' ? 'analyzed' : ds === 'cast_only' ? 'cast_only' : 'not_analyzed',
        docStatus: ds,
        lastAnalyzedAt: r.lastAnalyzedAt ? r.lastAnalyzedAt.toISOString() : null,
      };
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('[/api/programs GET]', e);
    return NextResponse.json([], { status: 200 });
  }
}
