import { NextRequest, NextResponse } from 'next/server';

// GET /api/programs/[name] — return full ProgramData object for a program
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  if (!process.env.DATABASE_URL) {
    const { PROGRAMS } = await import('@/lib/demo-data');
    const demo = PROGRAMS[name.toUpperCase()];
    if (demo) return NextResponse.json(demo);
    return NextResponse.json({ status: 'not_found' }, { status: 404 });
  }

  try {
    const { getProgramFullData, getProgram } = await import('@/lib/db/queries');

    // Check program exists at all
    const prog = await getProgram(name);
    if (!prog) {
      return NextResponse.json({ status: 'not_found' }, { status: 404 });
    }

    // Check if fully analyzed
    const data = await getProgramFullData(name);
    if (!data) {
      return NextResponse.json({ status: 'not_analyzed' });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error(`[/api/programs/${name} GET]`, e);
    return NextResponse.json({ status: 'not_analyzed' });
  }
}
