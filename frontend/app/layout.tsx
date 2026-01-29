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
    <html lang="en" className="dark" data-theme="midnight" data-reduced-motion="false">
      <body className="bg-[var(--background)] text-[var(--foreground)] antialiased min-h-screen relative selection:bg-zinc-800 selection:text-white">
        <div className="fixed inset-0 bg-grid-white opacity-5 pointer-events-none z-0" />
        <div className="fixed inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-0 pointer-events-none" />
        <SettingsSync />
        <Navbar />
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
