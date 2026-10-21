import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth, unauthorizedResponse } from '@/lib/auth';

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ repos: 0, programs: 0, jobs: 0 });
  }
  try {
    const { getAdminStats } = await import('@/lib/db/queries');
    return NextResponse.json(await getAdminStats());
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAdminAuth(req)) return unauthorizedResponse();
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'No database configured' }, { status: 503 });
  }
  // Deprecated: use DELETE /api/admin/repos/[id] for scoped deletes
  console.warn('[DEPRECATED] DELETE /api/admin — use scoped DELETE /api/admin/repos/[id] instead');
  try {
    const { clearAllProjects, recordAuditEvent } = await import('@/lib/db/queries');
    await clearAllProjects();
    await recordAuditEvent({ action: 'clear_all', targetType: 'all' }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
