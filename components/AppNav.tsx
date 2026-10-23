import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const FF_PROJECTS = process.env.FF_PROJECTS === 'true';
const FF_KNOWLEDGE = process.env.FF_KNOWLEDGE === 'true';
const FF_DOCS_V2 = process.env.FF_DOCS_V2 === 'true';

export async function AppNav() {
  const session = await getServerSession(authOptions);

  return (
    <nav className="border-b border-gray-800 bg-gray-950 px-6 py-3 flex items-center gap-6 text-sm">
      <Link href="/" className="font-semibold text-white tracking-tight">MAVEN</Link>
      <div className="flex items-center gap-4 text-gray-400">
        <Link href="/programs" className="hover:text-white transition-colors">Programs</Link>
        {FF_PROJECTS && (
          <Link href="/projects" className="hover:text-white transition-colors">Projects</Link>
        )}
        {FF_KNOWLEDGE && (
          <Link href="/reviews" className="hover:text-white transition-colors">Reviews</Link>
        )}
        {FF_DOCS_V2 && (
          <Link href="/docs" className="hover:text-white transition-colors">Documentation</Link>
        )}
        <Link href="/agents" className="hover:text-white transition-colors">Agents</Link>
        <Link href="/scopes" className="hover:text-white transition-colors">Scopes</Link>
      </div>
      <div className="ml-auto flex items-center gap-3">
        {session ? (
          <span className="text-gray-500 text-xs truncate max-w-[180px]" title={session.user?.email ?? ''}>
            {session.user?.email}
          </span>
        ) : (
          <Link
            href="/login"
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
