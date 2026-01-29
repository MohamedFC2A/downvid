import type { Metadata } from 'next';
import { Navbar } from '@/components/modules/navbar/Navbar';
import { SettingsSync } from '@/components/SettingsSync';
import './globals.css';

export const metadata: Metadata = {
  title: 'DOWNVID | Professional Video Downloader',
  description: 'High-performance video extraction and analysis platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" data-reduced-motion="false">
      <body className="bg-[var(--background)] text-[var(--foreground)] antialiased min-h-screen relative selection:bg-[var(--accent-soft)] selection:text-[var(--foreground)]">
        <div className="fixed inset-0 bg-grid opacity-60 pointer-events-none z-0" />
        <div className="fixed inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-transparent z-0 pointer-events-none" />
        <SettingsSync />
        <Navbar />
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
