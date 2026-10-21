import type { NextAuthOptions, DefaultSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';

declare module 'next-auth' {
  interface Session {
    user: { role: 'viewer' | 'editor' | 'admin' } & DefaultSession['user'];
  }
  interface User {
    role: 'viewer' | 'editor' | 'admin';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: 'viewer' | 'editor' | 'admin';
  }
}

function hashPassword(pw: string): string {
  return createHash('sha256').update(pw).digest('hex');
}

interface StaticUser {
  id: string;
  email: string;
  passwordHash: string;
  role: 'viewer' | 'editor' | 'admin';
}

function getStaticUsers(): StaticUser[] {
  const raw = process.env.MAVEN_USERS ?? '';
  if (!raw) return [];
  return raw.split(',').map((entry, i) => {
    const [email, password, role] = entry.trim().split(':');
    const validRole = (['viewer', 'editor', 'admin'] as const).includes(role?.trim() as 'viewer' | 'editor' | 'admin')
      ? (role.trim() as 'viewer' | 'editor' | 'admin')
      : 'viewer';
    return {
      id: String(i + 1),
      email: email?.trim() ?? '',
      passwordHash: hashPassword(password?.trim() ?? ''),
      role: validRole,
    };
  }).filter(u => u.email);
}

// Belt-and-suspenders admin check for route handlers.
// The NextAuth middleware already blocks non-admin roles from /api/admin,
// but routes that were created before NextAuth can call this as a fallback.
export function checkAdminAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
    const [user, pass] = decoded.split(':');
    const adminUser = process.env.ADMIN_USER ?? 'admin';
    const adminPass = process.env.ADMIN_PASSWORD ?? '';
    if (adminPass && user === adminUser && pass === adminPass) return true;
  }
  // If no Basic Auth env vars set, allow through — middleware is the gate
  if (!process.env.ADMIN_PASSWORD) return true;
  return false;
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="MAVEN Admin"',
      'Content-Type': 'application/json',
    },
  });
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const users = getStaticUsers();
        const user = users.find(
          u =>
            u.email.toLowerCase() === credentials.email.toLowerCase() &&
            u.passwordHash === hashPassword(credentials.password)
        );
        if (!user) return null;
        return { id: user.id, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = (user as { role: 'viewer' | 'editor' | 'admin' }).role;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.role = token.role;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
};
