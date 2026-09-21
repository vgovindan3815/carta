import { NextRequest, NextResponse } from 'next/server';

// GET /api/jobs/[jobId]/status — lightweight poll endpoint (non-SSE)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ status: 'unknown' });
  }
  try {
    const { jobId } = await params;
    const { getJob: getJobStatus } = await import('@/lib/db/queries');
    const job = await getJobStatus(jobId);
    if (!job) return NextResponse.json({ status: 'not_found' }, { status: 404 });
    return NextResponse.json({ status: job.status, error: job.error ?? null, progressPct: job.progressPct });
  } catch (e) {
    return NextResponse.json({ status: 'unknown', error: String(e) });
  }
}
