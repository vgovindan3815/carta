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
    const { getProgramById, deleteProgram, recordAuditEvent } = await import('@/lib/db/queries');
    const prog = await getProgramById(id);
    if (!prog) return Response.json({ error: 'not found' }, { status: 404 });

    if (body.confirm !== `delete ${prog.name}`) {
      return Response.json(
        { error: `confirmation must be: delete ${prog.name}` },
        { status: 400 }
      );
    }

    await deleteProgram(id);
    await recordAuditEvent({
      action: 'delete_program',
      targetType: 'program',
      targetId: id,
      targetName: prog.name,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
    });

    return Response.json({ deleted: true });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
