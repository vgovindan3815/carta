import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Read-only paths guests can access without a login session
const GUEST_GET: RegExp[] = [
  /^\/programs(\/|$)/,           // /programs and all sub-paths (UI pages)
  /^\/api\/programs\/?$/,        // GET /api/programs  (list)
  /^\/api\/programs\/[^/]+$/,    // GET /api/programs/[name]  (detail, no sub-paths)
  /^\/api\/repos\/?$/,           // GET /api/repos  (list)
  /^\/api\/jobs\//,              // GET /api/jobs/*  (SSE stream + status polling)
];

// LLM mutation routes guests may access if they supply their own API key header
const LLM_BYOK: RegExp[] = [
  /^\/api\/programs\/[^/]+\/(analyze|refresh)$/,
  /^\/api\/agents\//,
  /^\/api\/scopes\/[^/]+\/generate$/,
];

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // 1. Guest pass: read-only browsing paths (GET only)
  if (method === 'GET' && GUEST_GET.some(p => p.test(pathname))) {
    return NextResponse.next();
  }

  // 2. BYOK pass: LLM mutation routes with a user-supplied API key
  if (LLM_BYOK.some(p => p.test(pathname)) && req.headers.get('X-Maven-Api-Key')) {
    return NextResponse.next();
  }

  // 3. Standard NextAuth token check for everything else
  const token = await getToken({ req });

  if (!token) {
    // Redirect pages to /login; return 401 for API routes
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized', code: 'not_authenticated' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.href);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Admin-only routes
  if ((pathname.startsWith('/api/admin') || pathname.startsWith('/admin')) && token.role !== 'admin') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Editor+ for non-GET mutations on shared resources
  const editorPrefixes = ['/api/repos', '/api/programs', '/api/scopes'];
  if (
    editorPrefixes.some(p => pathname.startsWith(p)) &&
    method !== 'GET' &&
    !['editor', 'admin'].includes(String(token.role ?? ''))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/programs/:path*',
    '/agents/:path*',
    '/scopes/:path*',
    '/admin/:path*',
  ],
};
