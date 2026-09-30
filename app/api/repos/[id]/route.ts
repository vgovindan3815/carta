import { NextRequest, NextResponse } from 'next/server';

function checkAdminAuth(req: NextRequest): boolean {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return false;
  const user = process.env.ADMIN_USER ?? 'admin';
  const authHeader = req.headers.get('authorization') ?? '';
  const [scheme, encoded] = authHeader.split(' ');
  if (scheme !== 'Basic' || !encoded) return false;
  const [reqUser, reqPass] = Buffer.from(encoded, 'base64').toString('utf-8').split(':');
  return reqUser === user && reqPass === pass;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAdminAuth(req)) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="MAVEN/CARTA Admin — Delete"' },
    });
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
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
