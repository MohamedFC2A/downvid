import type { Metadata } from 'next';
import { Fraunces, Space_Grotesk, Montserrat } from 'next/font/google';
import { Navbar } from '@/components/modules/navbar/Navbar';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

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
    <html lang="en" className="dark">
      <body className={`${spaceGrotesk.variable} ${fraunces.variable} ${montserrat.variable} bg-black text-white antialiased min-h-screen relative selection:bg-zinc-800 selection:text-white`}>
        <div className="fixed inset-0 bg-grid-white opacity-5 pointer-events-none z-0" />
        <div className="fixed inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-0 pointer-events-none" />
        <Navbar />
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
