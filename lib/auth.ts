import type { NextAuthOptions, DefaultSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createHash, scryptSync, timingSafeEqual } from 'crypto';
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

/**
 * Hash a password using scrypt with an email-derived deterministic salt.
 * Significantly harder to brute-force than plain SHA-256 — scrypt is memory-hard.
 * For new deployments, migrate to per-user random salts stored in MAVEN_USERS.
 */
function hashPassword(pw: string, emailSalt?: string): string {
  if (emailSalt) {
    const salt = createHash('sha256').update('maven-salt-v1:' + emailSalt).digest('hex').slice(0, 32);
    return scryptSync(pw, salt, 64).toString('hex');
  }
  return createHash('sha256').update(pw).digest('hex');
}

function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
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
      passwordHash: hashPassword(password?.trim() ?? '', email?.trim()),
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
  // If no ADMIN_PASSWORD configured, deny at this layer — middleware is the primary gate
  if (!process.env.ADMIN_PASSWORD) return false;
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
            timingSafeStringEqual(u.passwordHash, hashPassword(credentials.password, credentials.email))
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
