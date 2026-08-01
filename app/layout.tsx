import type { Metadata } from 'next';
import './globals.css';
import { ScanProvider } from '@/components/ScanContext';
import { ScanToast } from '@/components/ScanToast';

export const metadata: Metadata = {
  title: 'MAVEN — Mainframe Analysis, Visualization & Engineering iNtelligence',
  description: 'On-demand, grounded understanding of your COBOL estate',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ScanProvider>
          {children}
          <ScanToast />
        </ScanProvider>
      </body>
    </html>
  );
}
