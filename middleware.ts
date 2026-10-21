import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Admin-only routes
    if (path.startsWith('/api/admin') && token?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Editor+ routes: non-GET mutations require editor or admin
    const editorPrefixes = ['/api/repos', '/api/programs', '/api/scopes'];
    const isEditorRoute = editorPrefixes.some(p => path.startsWith(p));
    if (isEditorRoute && req.method !== 'GET' && !['editor', 'admin'].includes(token?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token }) {
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/api/:path*',
    '/programs/:path*',
    '/agents/:path*',
    '/scopes/:path*',
    '/admin/:path*',
  ],
};
