import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const user = process.env.ADMIN_USER ?? 'admin';
  const pass = process.env.ADMIN_PASSWORD;

  if (!pass) {
    // No password configured — block access entirely rather than leave it open
    return new NextResponse('Admin access not configured.', { status: 503 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const [scheme, encoded] = authHeader.split(' ');

  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const [reqUser, reqPass] = decoded.split(':');
    if (reqUser === user && reqPass === pass) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="MAVEN/CARTA Admin"',
    },
  });
}

export const config = {
  matcher: ['/admin/:path*'],
};
