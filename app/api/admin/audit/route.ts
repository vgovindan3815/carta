import { NextRequest } from 'next/server';
import { checkAdminAuth, unauthorizedResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return unauthorizedResponse();
  if (!process.env.DATABASE_URL) {
    return Response.json({ events: [] });
  }
  try {
    const { getAuditEvents } = await import('@/lib/db/queries');
    const events = await getAuditEvents(100);
    return Response.json({ events });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
