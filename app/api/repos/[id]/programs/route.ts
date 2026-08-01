import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: repoId } = await params;
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ programs: [] });
  }
  try {
    const { listPrograms, getDocStatusForPrograms } = await import('@/lib/db/queries');
    const programs = await listPrograms(repoId);
    const docStatus = await getDocStatusForPrograms(programs.map((p) => p.id));
    return NextResponse.json({
      programs: programs.map((p) => ({
        id: p.id,
        name: p.name,
        language: p.language,
        loc: p.loc,
        desc: p.desc,
        filePath: p.filePath,
        analyzed: docStatus[p.id] === 'documented' || docStatus[p.id] === 'cast_only',
        fullyAnalyzed: docStatus[p.id] === 'documented',
        castOnly: docStatus[p.id] === 'cast_only',
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
