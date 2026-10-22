import { NextRequest } from 'next/server';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { createP1Scan } = await import('@/lib/db/queries');
  const { inngest } = await import('@/lib/inngest/client');

  const scan = await createP1Scan({ projectId });
  await inngest.send({ name: 'maven/scan.requested', data: { scanId: scan.id, projectId } });

  return Response.json({ scanId: scan.id, status: 'queued' });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { listP1ScansForProject } = await import('@/lib/db/queries');
  const scans = await listP1ScansForProject(projectId);
  return Response.json({ scans });
}
