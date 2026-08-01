import { NextResponse } from 'next/server';

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ repos: 0, programs: 0, jobs: 0 });
  }
  try {
    const { getAdminStats } = await import('@/lib/db/queries');
    return NextResponse.json(await getAdminStats());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'No database configured' }, { status: 503 });
  }
  try {
    const { clearAllProjects } = await import('@/lib/db/queries');
    await clearAllProjects();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
