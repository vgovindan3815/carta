import { NextRequest } from 'next/server';
import { checkAdminAuth, unauthorizedResponse } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAdminAuth(req)) return unauthorizedResponse();
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'No database configured' }, { status: 503 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  if (!body.confirm || typeof body.confirm !== 'string') {
    return Response.json({ error: 'confirmation required' }, { status: 400 });
  }

  try {
    const { getRepo, deleteRepo, recordAuditEvent } = await import('@/lib/db/queries');
    const repo = await getRepo(id);
    if (!repo) return Response.json({ error: 'not found' }, { status: 404 });

    const expectedConfirm = `delete ${repo.owner}/${repo.repo}`;
    if (body.confirm !== expectedConfirm) {
      return Response.json(
        { error: `confirmation must be: ${expectedConfirm}` },
        { status: 400 }
      );
    }

    await deleteRepo(id);
    await recordAuditEvent({
      action: 'delete_repo',
      targetType: 'repo',
      targetId: id,
      targetName: `${repo.owner}/${repo.repo}`,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
    });

    return Response.json({ deleted: true });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
