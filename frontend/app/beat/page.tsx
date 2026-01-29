'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useSettings } from '@/hooks/useSettings';
import { t } from '@/lib/i18n';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api` : '/api';

type BeatResponse = {
    title?: string;
    duration_seconds?: number | null;
    beats?: Array<{ start_sec: number; end_sec: number; label?: string; goal?: string; caption?: string }>;
    shorts?: Array<{ start_sec?: number; end_sec?: number; title?: string; hook?: string }>;
    exports?: { youtube_chapters?: string; markers_csv?: string };
};

function downloadText(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export default function BeatPage() {
    const { settings } = useSettings();
    const lang = settings.language;
    const auth = useAuth();
    const entitlements = useEntitlements();
    const [url, setUrl] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<BeatResponse | null>(null);

    const locked = useMemo(() => {
        if (!auth.configured) return false;
        return !entitlements.aiEnabled;
    }, [auth.configured, entitlements.aiEnabled]);

    async function onGenerate() {
        setError(null);
        setData(null);
        const u = url.trim();
        if (!u) return;
        if (auth.configured && !auth.accessToken) {
            setError(t(lang, 'beat.login'));
            return;
        }
        if (locked) {
            setError(t(lang, 'beat.locked'));
            return;
        }

        setBusy(true);
        try {
            const qs = new URLSearchParams();
            qs.set('lang', lang);
            const res = await fetch(`${API_BASE}/beat?${qs.toString()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
                },
                body: JSON.stringify({ url: u }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(json?.detail || json?.error || `BEAT failed (${res.status})`);
            }
            setData(json as BeatResponse);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'BEAT failed');
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="min-h-screen pt-28 pb-20 px-6">
            <div className="mx-auto w-full max-w-6xl space-y-10">
                <header className="flex flex-col gap-4">
                    <Logo />
                    <div className="space-y-2">
                        <p className={`text-xs font-mono text-[var(--foreground)] opacity-60 ${lang === 'ar' ? '' : 'uppercase tracking-[0.35em]'}`}>{t(lang, 'beat.kicker')}</p>
                        <h1 className="text-3xl md:text-5xl font-semibold text-[var(--foreground)]">
                            <span className="ultimate-silver">BEAT</span>
                            <span className="opacity-80"> — </span>
                            {t(lang, 'beat.title').replace(/^BEAT — /, '')}
                        </h1>
                        <p className="text-[var(--foreground)] opacity-60 max-w-2xl">
                            {t(lang, 'beat.subtitle')}
                        </p>
                    </div>
                </header>

                <Card className="rounded-3xl p-6" spotlight={false}>
                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                        <div className="space-y-2">
                            <div className="text-xs font-mono opacity-60">{t(lang, 'beat.url')}</div>
                            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t(lang, 'beat.placeholder')} disabled={busy} />
                        </div>
                        <Button className="h-10 px-6" onClick={onGenerate} disabled={busy || !url.trim()}>
                            {busy ? t(lang, 'beat.generating') : t(lang, 'beat.generate')}
                        </Button>
                    </div>

                    {locked && (
                        <div className="mt-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4 text-sm text-[var(--foreground)] opacity-80">
                            {t(lang, 'beat.locked')}{' '}
                            <Link className="underline underline-offset-4" href="/subscriptions">
                                {t(lang, 'beat.upgrade')}
                            </Link>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}
                </Card>

                {data && (
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card className="rounded-3xl p-6" spotlight={false}>
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="text-xs font-mono opacity-60">{t(lang, 'beat.sectionBeats')}</div>
                                    <div className="mt-2 text-lg font-semibold">{data.title || '—'}</div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        className="h-9 text-xs"
                                        onClick={() => downloadText('chapters.txt', data.exports?.youtube_chapters || '')}
                                        disabled={!data.exports?.youtube_chapters}
                                    >
                                        {t(lang, 'beat.downloadChapters')}
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        className="h-9 text-xs"
                                        onClick={() => downloadText('markers.csv', data.exports?.markers_csv || '')}
                                        disabled={!data.exports?.markers_csv}
                                    >
                                        {t(lang, 'beat.downloadMarkers')}
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-5 space-y-3">
                                {(data.beats || []).slice(0, 24).map((b, idx) => (
                                    <div key={idx} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-semibold">
                                                <span className="ultimate-silver">BEAT</span>
                                                <span className="opacity-70"> · </span>
                                                {b.label || `#${idx + 1}`}
                                            </div>
                                            <div className="text-[11px] font-mono opacity-65">
                                                {Math.max(0, Math.floor(b.start_sec))}s → {Math.max(0, Math.floor(b.end_sec))}s
                                            </div>
                                        </div>
                                        {(b.goal || b.caption) && (
                                            <div className="mt-2 text-xs text-[var(--foreground)] opacity-70 space-y-1">
                                                {b.goal && <div>{b.goal}</div>}
                                                {b.caption && <div className="opacity-80">{b.caption}</div>}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card className="rounded-3xl p-6" spotlight={false}>
                            <div className="text-xs font-mono opacity-60">{t(lang, 'beat.sectionShorts')}</div>
                            <div className="mt-5 space-y-3">
                                {(data.shorts || []).slice(0, 10).map((s, idx) => (
                                    <div key={idx} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-semibold">
                                                <span className="ultimate-silver">ULTIMATE</span>
                                                <span className="opacity-70"> · </span>
                                                {s.title || `Short #${idx + 1}`}
                                            </div>
                                            {(typeof s.start_sec === 'number' || typeof s.end_sec === 'number') && (
                                                <div className="text-[11px] font-mono opacity-65">
                                                    {Math.max(0, Math.floor(s.start_sec || 0))}s → {Math.max(0, Math.floor(s.end_sec || 0))}s
                                                </div>
                                            )}
                                        </div>
                                        {s.hook && (
                                            <div className="mt-2 text-xs text-[var(--foreground)] opacity-75">
                                                {s.hook}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </main>
    );
}

