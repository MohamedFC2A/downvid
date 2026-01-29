'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Card } from '@/components/ui/Card';
import { useSettings } from '@/hooks/useSettings';
import { t } from '@/lib/i18n';

type DocSection = { id: string; titleKey: string };

export default function DocsPage() {
    const { settings } = useSettings();
    const lang = settings.language;
    const rtl = lang === 'ar';

    const sections: DocSection[] = useMemo(
        () => [
            { id: 'overview', titleKey: 'docs.section.overview' },
            { id: 'how', titleKey: 'docs.section.how' },
            { id: 'subscriptions', titleKey: 'docs.section.subscriptions' },
            { id: 'beat', titleKey: 'docs.section.beat' },
            { id: 'auth', titleKey: 'docs.section.auth' },
            { id: 'faq', titleKey: 'docs.section.faq' },
            { id: 'developer', titleKey: 'docs.section.developer' },
        ],
        []
    );

    const [active, setActive] = useState<string>('overview');

    useEffect(() => {
        const els = sections
            .map((s) => document.getElementById(s.id))
            .filter(Boolean) as HTMLElement[];
        if (els.length === 0) return;

        const obs = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0))[0];
                if (visible?.target?.id) setActive(visible.target.id);
            },
            { root: null, rootMargin: '-20% 0px -70% 0px', threshold: [0.05, 0.1, 0.2, 0.35, 0.5] }
        );

        els.forEach((el) => obs.observe(el));
        return () => obs.disconnect();
    }, [sections]);

    function go(id: string) {
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    return (
        <main className="min-h-screen pt-28 pb-20 px-6">
            <div className="mx-auto w-full max-w-7xl space-y-10">
                <header className="flex flex-col gap-4">
                    <Logo />
                    <div className="space-y-2">
                        <p className={`text-xs font-mono text-[var(--foreground)] opacity-60 ${rtl ? '' : 'uppercase tracking-[0.35em]'}`}>
                            {t(lang, 'docs.kicker')}
                        </p>
                        <h1 className="text-3xl md:text-5xl font-semibold text-[var(--foreground)]">{t(lang, 'docs.title')}</h1>
                        <p className="text-[var(--foreground)] opacity-60 max-w-3xl">{t(lang, 'docs.subtitle')}</p>
                    </div>
                </header>

                <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                    <aside className="lg:sticky lg:top-24 h-fit">
                        <Card className="rounded-3xl p-4" spotlight={false}>
                            <div className="text-xs font-mono opacity-60 px-2">{t(lang, 'docs.contents')}</div>
                            <div className="mt-3 space-y-1">
                                {sections.map((s) => {
                                    const isActive = active === s.id;
                                    return (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => go(s.id)}
                                            className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-all ${
                                                isActive
                                                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                                                    : 'border-[var(--panel-border)] bg-[var(--deep)] hover:opacity-90'
                                            } ${rtl ? 'text-right' : ''}`}
                                        >
                                            {t(lang, s.titleKey)}
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>
                    </aside>

                    <article className="space-y-6">
                        <DocCard id="overview" title={t(lang, 'docs.section.overview')}>
                            <p className="text-sm opacity-75 leading-relaxed">{t(lang, 'docs.overview.p1')}</p>
                            <ul className="mt-4 space-y-2 text-sm opacity-75">
                                <li>{t(lang, 'docs.overview.b1')}</li>
                                <li>{t(lang, 'docs.overview.b2')}</li>
                                <li>{t(lang, 'docs.overview.b3')}</li>
                            </ul>
                        </DocCard>

                        <DocCard id="how" title={t(lang, 'docs.section.how')}>
                            <ol className="space-y-2 text-sm opacity-75 list-decimal pl-5">
                                <li>{t(lang, 'docs.how.s1')}</li>
                                <li>{t(lang, 'docs.how.s2')}</li>
                                <li>{t(lang, 'docs.how.s3')}</li>
                            </ol>
                        </DocCard>

                        <DocCard id="subscriptions" title={t(lang, 'docs.section.subscriptions')}>
                            <p className="text-sm opacity-75 leading-relaxed">{t(lang, 'docs.subs.p1')}</p>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4">
                                    <div className="text-xs font-mono opacity-60">{t(lang, 'subs.free')}</div>
                                    <div className="mt-2 text-sm font-semibold">{t(lang, 'subs.freeDownloads')}</div>
                                    <div className="mt-1 text-xs opacity-65">{t(lang, 'subs.noAi')}</div>
                                </div>
                                <div className="ultimate-sheen-border rounded-2xl p-[1px]">
                                    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4">
                                        <div className="text-xs font-mono opacity-60">{t(lang, 'subs.ultimate')}</div>
                                        <div className="mt-2 text-sm font-semibold">
                                            <span className="ultimate-silver">{t(lang, 'subs.unlimitedDownloads')}</span>
                                        </div>
                                        <div className="mt-1 text-xs opacity-65">{t(lang, 'subs.allAi')}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 text-sm opacity-75">
                                <Link className="underline underline-offset-4" href="/subscriptions">
                                    {t(lang, 'docs.subs.cta')}
                                </Link>
                            </div>
                        </DocCard>

                        <DocCard id="beat" title={t(lang, 'docs.section.beat')}>
                            <p className="text-sm opacity-75 leading-relaxed">{t(lang, 'docs.beat.p1')}</p>
                            <ul className="mt-4 space-y-2 text-sm opacity-75">
                                <li>
                                    <span className="ultimate-silver">BEAT</span> — {t(lang, 'docs.beat.b1')}
                                </li>
                                <li>
                                    <span className="ultimate-silver">ULTIMATE</span> — {t(lang, 'docs.beat.b2')}
                                </li>
                            </ul>
                            <div className="mt-4 text-sm opacity-75">
                                <Link className="underline underline-offset-4" href="/beat">
                                    {t(lang, 'docs.beat.cta')}
                                </Link>
                            </div>
                        </DocCard>

                        <DocCard id="auth" title={t(lang, 'docs.section.auth')}>
                            <p className="text-sm opacity-75 leading-relaxed">{t(lang, 'docs.auth.p1')}</p>
                        </DocCard>

                        <DocCard id="faq" title={t(lang, 'docs.section.faq')}>
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4">
                                    <div className="text-sm font-semibold">{t(lang, 'docs.faq.q1')}</div>
                                    <div className="mt-2 text-sm opacity-70">{t(lang, 'docs.faq.a1')}</div>
                                </div>
                                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4">
                                    <div className="text-sm font-semibold">{t(lang, 'docs.faq.q2')}</div>
                                    <div className="mt-2 text-sm opacity-70">{t(lang, 'docs.faq.a2')}</div>
                                </div>
                            </div>
                        </DocCard>

                        <DocCard id="developer" title={t(lang, 'docs.section.developer')}>
                            <p className="text-sm opacity-75 leading-relaxed">{t(lang, 'docs.dev.p1')}</p>
                            <div className="mt-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4">
                                <div className="text-xs font-mono opacity-60">{t(lang, 'docs.dev.by')}</div>
                                <div className="mt-2 text-sm font-semibold">محمد أحمد مكعني</div>
                            </div>
                        </DocCard>
                    </article>
                </div>
            </div>
        </main>
    );
}

function DocCard({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
    return (
        <Card id={id} className="rounded-3xl p-6 scroll-mt-28" spotlight={false}>
            <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-semibold">{title}</div>
            </div>
            <div className="mt-4">{children}</div>
        </Card>
    );
}
