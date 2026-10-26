import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AppShellClient } from './AppShellClient';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

  return (
    <AppShellClient
      userEmail={session?.user?.email}
      isAdmin={isAdmin}
    >
      {children}
    </AppShellClient>
  );
}
