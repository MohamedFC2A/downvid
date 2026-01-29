'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { useSettings } from '@/hooks/useSettings';
import { t } from '@/lib/i18n';

export function Navbar() {
    const { settings } = useSettings();
    const pathname = usePathname();
    const isRtl = settings.language === 'ar';

    const nav = [
        { href: '/tool', key: 'nav.tool' as const },
        { href: '/settings', key: 'nav.settings' as const },
        { href: '#', key: 'nav.docs' as const },
    ];

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--panel-border)] bg-[var(--panel)] backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center">
                    <Logo />
                </Link>
                <div className={`flex items-center gap-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
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
        </nav>
    );
}
