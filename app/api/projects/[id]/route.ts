import { NextRequest } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { getProject, getSourceConnectionsForProject, listScansForProject } = await import('@/lib/db/queries');
  const [project, connections, scans] = await Promise.all([
    getProject(id),
    getSourceConnectionsForProject(id),
    listScansForProject(id),
  ]);
  if (!project) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ project, connections, scans });
}
