'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useSettings } from '@/hooks/useSettings';
import { t } from '@/lib/i18n';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api` : '/api';

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
    const [promo, setPromo] = useState('');
    const [promoBusy, setPromoBusy] = useState(false);
    const [promoMsg, setPromoMsg] = useState<string | null>(null);
    const [promoErr, setPromoErr] = useState<string | null>(null);

    const ultimateUntilLabel = useMemo(() => {
        if (!entitlements.ultimateUntil) return null;
        try {
            const d = new Date(entitlements.ultimateUntil);
            const label = d.toLocaleString(lang === 'ar' ? 'ar' : 'en', {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });
            return t(lang, 'subs.ultimateUntil', { date: label });
        } catch {
            return t(lang, 'subs.ultimateUntil', { date: String(entitlements.ultimateUntil) });
        }
    }, [entitlements.ultimateUntil, lang]);

    async function redeemPromo() {
        setPromoErr(null);
        setPromoMsg(null);
        const code = promo.trim();
        if (!code) return;
        if (!auth.accessToken) {
            setPromoErr(t(lang, 'subs.loginRequired'));
            return;
        }
        setPromoBusy(true);
        try {
            const res = await fetch(`${API_BASE}/promo/redeem`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${auth.accessToken}`,
                },
                body: JSON.stringify({ code }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(json?.detail || json?.message || 'Redeem failed');
            }
            if (!json?.success) {
                setPromoErr(json?.message || t(lang, 'subs.promoInvalid'));
                return;
            }
            setPromo('');
            setPromoMsg(json?.message || t(lang, 'subs.promoSuccess'));
            await entitlements.refresh();
        } catch (e) {
            setPromoErr(e instanceof Error ? e.message : t(lang, 'subs.promoInvalid'));
        } finally {
            setPromoBusy(false);
        }
    }

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
                                    ultimateUntilLabel ? ultimateUntilLabel : t(lang, 'subs.currentUltimate')
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

                    <div className="ultimate-sheen-border rounded-3xl p-[1px]">
                        <Card className="rounded-3xl p-6" spotlight={false}>
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="text-xs font-mono opacity-70">{t(lang, 'subs.ultimate')}</div>
                                    <div className="mt-2 text-2xl font-semibold leading-tight">
                                        <span className="ultimate-silver">{t(lang, 'subs.ultimateTitle')}</span>
                                    </div>
                                </div>
                                <div className="text-xs font-mono opacity-70">
                                    {entitlements.plan === 'ultimate' ? t(lang, 'subs.active') : t(lang, 'subs.recommended')}
                                </div>
                            </div>

                            <div className="mt-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4">
                                <div className="text-sm font-semibold text-[var(--foreground)]">{t(lang, 'subs.ultimatePowerTitle')}</div>
                                <div className="mt-1 text-xs text-[var(--foreground)] opacity-65">{t(lang, 'subs.ultimatePowerSub')}</div>
                            </div>

                            <ul className="mt-5 space-y-2">
                                <Feature>{t(lang, 'subs.feature.unlimited')}</Feature>
                                <Feature>{t(lang, 'subs.feature.aiInsights')}</Feature>
                                <Feature>{t(lang, 'subs.feature.aiSummary')}</Feature>
                                <Feature>{t(lang, 'subs.feature.aiFix')}</Feature>
                                <Feature>{t(lang, 'subs.feature.upscale')}</Feature>
                                <Feature>{t(lang, 'subs.feature.formats')}</Feature>
                                <Feature>{t(lang, 'subs.feature.priority')}</Feature>
                                <Feature>{t(lang, 'subs.feature.future')}</Feature>
                            </ul>

                            <div className="mt-6 rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-semibold">{t(lang, 'subs.promoTitle')}</div>
                                        <div className="text-xs text-[var(--foreground)] opacity-60">{t(lang, 'subs.promoHint')}</div>
                                    </div>
                                    {ultimateUntilLabel && entitlements.plan === 'ultimate' && (
                                        <div className="text-[11px] font-mono text-[var(--foreground)] opacity-65 text-right">
                                            {ultimateUntilLabel}
                                        </div>
                                    )}
                                </div>

                                {!auth.user ? (
                                    <div className="text-sm text-[var(--foreground)] opacity-75">
                                        <Link className="underline underline-offset-4" href="/auth">
                                            {t(lang, 'subs.loginToUse')}
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="flex gap-3">
                                        <Input
                                            value={promo}
                                            onChange={(e) => setPromo(e.target.value)}
                                            placeholder={t(lang, 'subs.promoPlaceholder')}
                                            disabled={promoBusy}
                                        />
                                        <Button className="h-10 px-5" onClick={redeemPromo} disabled={promoBusy || !promo.trim()}>
                                            {promoBusy ? t(lang, 'subs.promoRedeeming') : t(lang, 'subs.promoRedeem')}
                                        </Button>
                                    </div>
                                )}

                                {promoErr && (
                                    <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs text-red-700">
                                        {promoErr}
                                    </div>
                                )}
                                {promoMsg && (
                                    <div className="rounded-xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-xs text-green-700">
                                        {promoMsg}
                                    </div>
                                )}
                            </div>

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
            </div>
        </main>
    );
}
