'use client';

import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useSettings } from '@/hooks/useSettings';
import { t } from '@/lib/i18n';

function Feature({ children }: { children: React.ReactNode }) {
    return (
        <li className="text-sm text-[var(--foreground)] opacity-75 leading-relaxed">
            {children}
        </li>
    );
}

export default function SubscriptionsPage() {
    const { settings } = useSettings();
    const lang = settings.language;
    const auth = useAuth();
    const entitlements = useEntitlements();

    return (
        <main className="min-h-screen pt-28 pb-20 px-6">
            <div className="mx-auto w-full max-w-6xl space-y-10">
                <header className="flex flex-col gap-4">
                    <Logo />
                    <div className="space-y-2">
                        <p className={`text-xs font-mono text-[var(--foreground)] opacity-60 ${lang === "ar" ? "" : "uppercase tracking-[0.35em]"}`}>{t(lang, 'subs.kicker')}</p>
                        <h1 className="text-3xl md:text-4xl font-semibold text-[var(--foreground)]">{t(lang, 'subs.title')}</h1>
                        <p className="text-[var(--foreground)] opacity-60 max-w-2xl">
                            {t(lang, 'subs.subtitle')}
                        </p>
                    </div>
                </header>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="rounded-3xl p-6" spotlight={false}>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-xs font-mono opacity-60">{t(lang, 'subs.free')}</div>
                                <div className="mt-2 text-xl font-semibold">{t(lang, 'subs.freeTitle')}</div>
                            </div>
                            <div className="text-xs font-mono opacity-70">
                                {entitlements.plan === 'free' ? t(lang, 'subs.active') : t(lang, 'subs.included')}
                            </div>
                        </div>

                        <ul className="mt-5 space-y-2">
                            <Feature>{t(lang, 'subs.freeDownloads')}</Feature>
                            <Feature>{t(lang, 'subs.noAi')}</Feature>
                        </ul>

                        <div className="mt-6 rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4 text-sm text-[var(--foreground)] opacity-75">
                            {auth.user ? (
                                entitlements.plan === 'ultimate' ? (
                                    t(lang, 'subs.currentUltimate')
                                ) : (
                                    t(lang, 'subs.currentFreeRemaining', { remaining: String(entitlements.downloadsRemaining ?? 0) })
                                )
                            ) : (
                                <Link className="underline underline-offset-4" href="/auth">
                                    {t(lang, 'subs.loginToUse')}
                                </Link>
                            )}
                        </div>
                    </Card>

                    <Card className="rounded-3xl p-6" spotlight={false}>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-xs font-mono opacity-60">{t(lang, 'subs.ultimate')}</div>
                                <div className="mt-2 text-xl font-semibold">{t(lang, 'subs.ultimateTitle')}</div>
                            </div>
                            <div className="text-xs font-mono opacity-70">
                                {entitlements.plan === 'ultimate' ? t(lang, 'subs.active') : t(lang, 'subs.recommended')}
                            </div>
                        </div>

                        <ul className="mt-5 space-y-2">
                            <Feature>{t(lang, 'subs.unlimitedDownloads')}</Feature>
                            <Feature>{t(lang, 'subs.allAi')}</Feature>
                        </ul>

                        <div className="mt-6 flex gap-3">
                            <Link href="/tool" className="flex-1">
                                <Button variant="secondary" className="h-11 w-full">
                                    {t(lang, 'subs.goTool')}
                                </Button>
                            </Link>
                            <Link href="/auth" className="flex-1">
                                <Button className="h-11 w-full" disabled={!auth.configured}>
                                    {t(lang, 'subs.upgradeCta')}
                                </Button>
                            </Link>
                        </div>

                        <div className="mt-4 text-xs text-[var(--foreground)] opacity-60">
                            {t(lang, 'subs.upgradeHint')}
                        </div>
                    </Card>
                </div>
            </div>
        </main>
    );
}

