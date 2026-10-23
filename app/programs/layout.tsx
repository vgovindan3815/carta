import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { LoginSplash } from '@/components/LoginSplash';
import { GuestBanner } from '@/components/GuestBanner';

export default async function ProgramsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <>
      {/* Show login splash + guest banner only for unauthenticated visitors */}
      {!session && (
        <>
          <LoginSplash />
          <GuestBanner />
        </>
      )}
      {children}
    </>
  );
}
