import { NextRequest, NextResponse } from 'next/server';
import { safeEqual } from './crypto';

export function checkAdminAuth(req: NextRequest): boolean {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return false;
  const user = process.env.ADMIN_USER ?? 'admin';

  const authHeader = req.headers.get('authorization') ?? '';
  const [scheme, encoded] = authHeader.split(' ');
  if (scheme !== 'Basic' || !encoded) return false;

  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  const colonIdx = decoded.indexOf(':');
  if (colonIdx === -1) return false;

  const reqUser = decoded.slice(0, colonIdx);
  const reqPass = decoded.slice(colonIdx + 1);
  return safeEqual(reqUser, user) && safeEqual(reqPass, pass);
}

export function unauthorizedResponse(realm = 'MAVEN/CARTA Admin'): NextResponse {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${realm}"` },
  });
}
