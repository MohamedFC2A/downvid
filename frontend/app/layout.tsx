'use client';
import type { Metadata } from 'next';
import { Navbar } from '@/components/modules/navbar/Navbar';
import { SettingsSync } from '@/components/SettingsSync';
import { EntitlementsSync } from '@/components/EntitlementsSync';
import { useSettings } from '@/hooks/useSettings';
import { getDirection } from '@/lib/i18n';
import { useEffect } from 'react';
import './globals.css';

function LayoutBody({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const lang = settings.language;
  const dir = getDirection(lang);

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', dir);
  }, [lang, dir]);

  return (
    <body className="bg-[var(--background)] text-[var(--foreground)] antialiased min-h-screen relative selection:bg-[var(--accent-soft)] selection:text-[var(--foreground)]">
      <div className="fixed inset-0 bg-grid opacity-60 pointer-events-none z-0" />
      <div className="fixed inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-transparent z-0 pointer-events-none" />
      <SettingsSync />
      <EntitlementsSync />
      <Navbar />
      <div className="relative z-10">
        {children}
      </div>
    </body>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" data-theme="light" data-reduced-motion="false" suppressHydrationWarning>
      <LayoutBody>{children}</LayoutBody>
    </html>
  );
}

