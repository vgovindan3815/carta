import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MAVEN — Mainframe Analysis, Visualization & Engineering iNtelligence',
  description: 'On-demand, grounded understanding of your COBOL estate',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
