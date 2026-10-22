import { NextRequest } from 'next/server';

export async function GET() {
  const { listProjects } = await import('@/lib/db/queries');
  const projects = await listProjects();
  return Response.json({ projects });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name?.trim()) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }

  const { createProject, createSourceConnection } = await import('@/lib/db/queries');
  const { encrypt } = await import('@/lib/crypto');

  const project = await createProject({
    name: body.name.trim(),
    description: body.description?.trim() || undefined,
  });

  if (body.githubUrl) {
    const match = /github\.com\/([^/]+)\/([^/]+)/.exec(body.githubUrl);
    if (match) {
      const [, owner, repo] = match;
      const patEncryptedRef = body.pat ? encrypt(body.pat) : undefined;
      await createSourceConnection({
        projectId: project.id,
        kind: 'github',
        owner,
        repo: repo.replace(/\.git$/, ''),
        branch: body.branch || 'main',
        patEncryptedRef,
      });
    }
  }

  if (body.startScan) {
    try {
      const { createP1Scan } = await import('@/lib/db/queries');
      const { inngest } = await import('@/lib/inngest/client');
      const scan = await createP1Scan({ projectId: project.id });
      await inngest.send({ name: 'maven/scan.requested', data: { scanId: scan.id, projectId: project.id } });
    } catch {
      // non-fatal — project created, scan will need to be triggered manually
    }
  }

  return Response.json({ project }, { status: 201 });
}
