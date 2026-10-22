import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) return Response.json({ error: 'projectId required' }, { status: 400 });

  const { getDocumentsForProject } = await import('@/lib/db/queries');
  const docs = await getDocumentsForProject(projectId);
  return Response.json({ documents: docs });
}
