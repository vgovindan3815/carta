import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ScanProvider } from '@/components/ScanContext';
import { ScanToast } from '@/components/ScanToast';
import { SessionWrapper } from '@/components/SessionWrapper';
import { AppShell } from '@/components/shell/AppShell';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Mainframe Knowledge Platform — AI-Powered Mainframe Intelligence',
  description: 'On-demand, grounded understanding of your COBOL estate',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <SessionWrapper>
          <ScanProvider>
            <AppShell>{children}</AppShell>
            <ScanToast />
          </ScanProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}
