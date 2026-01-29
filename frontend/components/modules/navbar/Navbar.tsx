'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { useSettings } from '@/hooks/useSettings';
import { t } from '@/lib/i18n';

export function Navbar() {
    const { settings } = useSettings();
    const pathname = usePathname();
    const isRtl = settings.language === 'ar';
    const [open, setOpen] = useState(false);

    const nav = [
        { href: '/tool', key: 'nav.tool' as const },
        { href: '/settings', key: 'nav.settings' as const },
        { href: '#', key: 'nav.docs' as const },
    ];

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--panel-border)] bg-[var(--panel)] backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
                <Link href="/" className="flex items-center shrink-0" onClick={() => setOpen(false)}>
                    <div className="scale-[0.92] sm:scale-100 origin-left">
                        <Logo />
                    </div>
                </Link>

                {/* Mobile */}
                <div className="flex items-center gap-2 md:hidden">
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-[var(--panel-border)] bg-[var(--deep)] text-[var(--foreground)]"
                        aria-label={t(settings.language, 'nav.menu')}
                        aria-expanded={open}
                    >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                        </svg>
                    </button>
                </div>

                {/* Desktop */}
                <div className={`hidden md:flex items-center gap-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    {nav.map((item) => {
                        const active = item.href !== '#' && (pathname === item.href || pathname.startsWith(`${item.href}/`));
                        return (
                            <Link
                                key={item.key}
                                href={item.href}
                                className={`text-sm font-medium transition-opacity ${
                                    active
                                        ? 'text-[var(--foreground)] opacity-100'
                                        : 'text-[var(--foreground)] opacity-70 hover:opacity-100'
                                }`}
                            >
                                {t(settings.language, item.key)}
                            </Link>
                        );
                    })}
                    <div className="h-4 w-px bg-[var(--panel-border)]" />
                    <Button variant="secondary" className="h-8 text-xs">
                        {t(settings.language, 'nav.login')}
                    </Button>
                </div>
            </div>

            {/* Mobile menu panel */}
            {open && (
                <div className="md:hidden border-t border-[var(--panel-border)] bg-[var(--panel)] backdrop-blur-md">
                    <div className={`px-4 py-3 space-y-2 ${isRtl ? 'text-right' : 'text-left'}`}>
                        {nav.map((item) => {
                            const active = item.href !== '#' && (pathname === item.href || pathname.startsWith(`${item.href}/`));
                            return (
                                <Link
                                    key={`m-${item.key}`}
                                    href={item.href}
                                    onClick={() => setOpen(false)}
                                    className={`block rounded-lg border border-[var(--panel-border)] bg-[var(--deep)] px-3 py-2 text-sm font-semibold ${
                                        active ? 'opacity-100' : 'opacity-85'
                                    }`}
                                >
                                    {t(settings.language, item.key)}
                                </Link>
                            );
                        })}
                        <div className="pt-1">
                            <Button variant="secondary" className="h-10 w-full text-sm" onClick={() => setOpen(false)}>
                                {t(settings.language, 'nav.login')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}
