import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
  }

  const { id } = await params;
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'No database configured' }, { status: 503 });
  }
  try {
    const { deleteProject } = await import('@/lib/db/queries');
    await deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/repos]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
