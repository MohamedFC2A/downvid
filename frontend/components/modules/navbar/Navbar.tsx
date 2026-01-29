'use client';

import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { useSettings } from '@/hooks/useSettings';
import { t } from '@/lib/i18n';

export function Navbar() {
    const { settings } = useSettings();
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--panel-border)] bg-[var(--panel)] backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center">
                    <Logo />
                </Link>
                <div className="flex items-center gap-6">
                    <Link href="/tool" className="text-sm font-medium text-[var(--foreground)] opacity-70 hover:opacity-100 transition-opacity">{t(settings.language, 'nav.tool')}</Link>
                    <Link href="/settings" className="text-sm font-medium text-[var(--foreground)] opacity-70 hover:opacity-100 transition-opacity">{t(settings.language, 'nav.settings')}</Link>
                    <Link href="#" className="text-sm font-medium text-[var(--foreground)] opacity-70 hover:opacity-100 transition-opacity">{t(settings.language, 'nav.docs')}</Link>
                    <div className="h-4 w-px bg-[var(--panel-border)]" />
                    <Button variant="secondary" className="h-8 text-xs">{t(settings.language, 'nav.login')}</Button>
                </div>
            </div>
        </nav>
    );
}
