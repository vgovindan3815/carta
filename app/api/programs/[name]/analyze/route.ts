import { NextRequest, NextResponse } from 'next/server';

// POST /api/programs/[name]/analyze — create a job and return jobId
// The actual pipeline runs when GET /api/jobs/[jobId] is opened (SSE)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  if (!process.env.DATABASE_URL) {
    // No DB — the UI will fall back to demo simulation
    return NextResponse.json({ jobId: null });
  }

  try {
    const { getProgram, createJob } = await import('@/lib/db/queries');

    const prog = await getProgram(name);
    if (!prog) {
      return NextResponse.json({ error: `Program ${name} not found` }, { status: 404 });
    }

    const job = await createJob(prog.id);
    return NextResponse.json({ jobId: job.id });
  } catch (e) {
    console.error(`[/api/programs/${name}/analyze POST]`, e);
    return NextResponse.json({ jobId: null });
  }
}
