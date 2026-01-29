'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useSettings } from '@/hooks/useSettings';
import { t } from '@/lib/i18n';

type BeatResponse = {
    title?: string;
    duration_seconds?: number | null;
    beats?: Array<{ start_sec: number; end_sec: number; label?: string; goal?: string; caption?: string }>;
    shorts?: Array<{ start_sec?: number; end_sec?: number; title?: string; hook?: string }>;
    exports?: { youtube_chapters?: string; markers_csv?: string; shotlist_md?: string; broll_prompts?: string };
};

type SceneCut = { time_sec: number; score: number; thumbnail_data_url: string };

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

function fmtTime(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default function BeatPage() {
    const { settings, updateSettings } = useSettings();
    const lang = settings.language;
    const rtl = lang === 'ar';
    const auth = useAuth();
    const entitlements = useEntitlements();

    const [mode, setMode] = useState<'url' | 'upload'>('url');
    const [url, setUrl] = useState('');

    const [file, setFile] = useState<File | null>(null);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [fileMeta, setFileMeta] = useState<{ duration: number; width: number; height: number } | null>(null);
    const [localTitle, setLocalTitle] = useState('');
    const [localDescription, setLocalDescription] = useState('');
    const [localTranscript, setLocalTranscript] = useState('');

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<BeatResponse | null>(null);

    const [thumbs, setThumbs] = useState<Record<string, string>>({});
    const [thumbBusy, setThumbBusy] = useState(false);
    const [thumbProgress, setThumbProgress] = useState<{ done: number; total: number } | null>(null);
    const [cutsBusy, setCutsBusy] = useState(false);
    const [cuts, setCuts] = useState<SceneCut[]>([]);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const locked = useMemo(() => {
        if (!auth.configured) return false;
        return !entitlements.aiEnabled;
    }, [auth.configured, entitlements.aiEnabled]);

    useEffect(() => {
        if (!file) return;
        const next = URL.createObjectURL(file);
        setFileUrl(next);
        setFileMeta(null);
        setCuts([]);
        setThumbs({});
        setData(null);
        setError(null);
        return () => {
            URL.revokeObjectURL(next);
        };
    }, [file]);

    useEffect(() => {
        if (!fileUrl) return;
        const video = videoRef.current;
        if (!video) return;
        video.src = fileUrl;
        const onMeta = () => {
            setFileMeta({
                duration: Number.isFinite(video.duration) ? video.duration : 0,
                width: video.videoWidth || 0,
                height: video.videoHeight || 0,
            });
        };
        video.addEventListener('loadedmetadata', onMeta);
        return () => {
            video.removeEventListener('loadedmetadata', onMeta);
        };
    }, [fileUrl]);

    function ensureCanvas(): HTMLCanvasElement {
        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
        }
        return canvasRef.current;
    }

    async function seekTo(sec: number): Promise<void> {
        const video = videoRef.current;
        if (!video) throw new Error('Video is not ready');
        if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('Invalid video duration');
        const tSec = Math.max(0, Math.min(video.duration - 0.05, sec));
        await new Promise<void>((resolve, reject) => {
            const onSeeked = () => resolve();
            const onError = () => reject(new Error('Video seek failed'));
            video.addEventListener('seeked', onSeeked, { once: true });
            video.addEventListener('error', onError, { once: true });
            try {
                video.currentTime = tSec;
            } catch (e) {
                reject(e instanceof Error ? e : new Error('Seek failed'));
            }
        });
    }

    async function captureJpeg(sec: number, targetWidth = 520): Promise<string> {
        const video = videoRef.current;
        if (!video) throw new Error('Video is not ready');
        await seekTo(sec);
        const canvas = ensureCanvas();
        const vw = video.videoWidth || 0;
        const vh = video.videoHeight || 0;
        if (!vw || !vh) throw new Error('Invalid video size');
        const width = Math.max(140, Math.min(targetWidth, vw));
        const height = Math.max(90, Math.floor((width / vw) * vh));
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not available');
        ctx.drawImage(video, 0, 0, width, height);
        return canvas.toDataURL('image/jpeg', 0.86);
    }

    async function frameStats(sec: number): Promise<{ r: number; g: number; b: number }> {
        const video = videoRef.current;
        if (!video) throw new Error('Video is not ready');
        await seekTo(sec);
        const canvas = ensureCanvas();
        canvas.width = 40;
        canvas.height = 22;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Canvas not available');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = img.data;
        let r = 0;
        let g = 0;
        let b = 0;
        const n = canvas.width * canvas.height;
        for (let i = 0; i < px.length; i += 4) {
            r += px[i];
            g += px[i + 1];
            b += px[i + 2];
        }
        return { r: r / n, g: g / n, b: b / n };
    }

    async function analyzeCuts() {
        setCuts([]);
        setError(null);
        const meta = fileMeta;
        if (!meta || !Number.isFinite(meta.duration) || meta.duration <= 0) return;
        setCutsBusy(true);
        try {
            const maxSamples = 120;
            const step = Math.max(0.8, meta.duration / maxSamples);
            let prev: { r: number; g: number; b: number } | null = null;
            const diffs: Array<{ time_sec: number; score: number }> = [];
            for (let tSec = 0; tSec < meta.duration; tSec += step) {
                const now = await frameStats(tSec);
                if (prev) {
                    const dr = now.r - prev.r;
                    const dg = now.g - prev.g;
                    const db = now.b - prev.b;
                    diffs.push({ time_sec: tSec, score: Math.sqrt(dr * dr + dg * dg + db * db) });
                }
                prev = now;
            }
            diffs.sort((a, b) => b.score - a.score);
            const picks = diffs.slice(0, 12).sort((a, b) => a.time_sec - b.time_sec);
            const out: SceneCut[] = [];
            for (const p of picks) {
                out.push({ time_sec: p.time_sec, score: p.score, thumbnail_data_url: await captureJpeg(p.time_sec, 520) });
            }
            setCuts(out);
        } catch (e) {
            setError(e instanceof Error ? e.message : t(lang, 'beat.visionFailed'));
        } finally {
            setCutsBusy(false);
        }
    }

    async function generateBeatThumbnails(next: BeatResponse) {
        const beats = (next.beats || []).slice(0, 24);
        if (!beats.length) return;
        setThumbBusy(true);
        setThumbProgress({ done: 0, total: beats.length });
        try {
            const out: Record<string, string> = {};
            for (let i = 0; i < beats.length; i++) {
                out[String(i)] = await captureJpeg(beats[i].start_sec, 520);
                setThumbProgress({ done: i + 1, total: beats.length });
            }
            setThumbs(out);
        } catch (e) {
            setError(e instanceof Error ? e.message : t(lang, 'beat.thumbsFailed'));
        } finally {
            setThumbBusy(false);
            setThumbProgress(null);
        }
    }

    async function onGenerate() {
        setError(null);
        setData(null);
        setCuts([]);
        setThumbs({});

        const u = url.trim();
        const hasUrl = mode === 'url' && Boolean(u);
        const hasUpload = mode === 'upload' && Boolean(fileMeta?.duration);
        if (!hasUrl && !hasUpload) return;
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
            const res = await fetch(`/api/beat?${qs.toString()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
                },
                body: JSON.stringify(
                    hasUrl
                        ? { url: u }
                        : {
                              title: localTitle.trim() || file?.name || 'Video',
                              description: localDescription.trim(),
                              duration_seconds: Math.floor(fileMeta?.duration || 0),
                              transcript_text: localTranscript.trim(),
                          }
                ),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(json?.detail || json?.error || `BEAT failed (${res.status})`);
            }
            const next = json as BeatResponse;
            setData(next);
            if (mode === 'upload') {
                void generateBeatThumbnails(next);
                void analyzeCuts();
            }
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
                    <div className="flex flex-col gap-5">
                        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-3">
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setMode('url')}
                                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                                        mode === 'url'
                                            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                                            : 'border-[var(--panel-border)] bg-[var(--panel)] opacity-80 hover:opacity-100'
                                    }`}
                                >
                                    {t(lang, 'beat.modeUrl')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('upload')}
                                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                                        mode === 'upload'
                                            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                                            : 'border-[var(--panel-border)] bg-[var(--panel)] opacity-80 hover:opacity-100'
                                    }`}
                                >
                                    {t(lang, 'beat.modeUpload')}
                                </button>
                            </div>
                        </div>

                        {mode === 'url' ? (
                            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                                <div className="space-y-2">
                                    <div className="text-xs font-mono opacity-60">{t(lang, 'beat.url')}</div>
                                    <Input
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder={t(lang, 'beat.placeholder')}
                                        disabled={busy}
                                    />
                                </div>
                                <Button className="h-10 px-6" onClick={onGenerate} disabled={busy || !url.trim()}>
                                    {busy ? t(lang, 'beat.generating') : t(lang, 'beat.generate')}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                                    <div className="space-y-2">
                                        <div className="text-xs font-mono opacity-60">{t(lang, 'beat.upload')}</div>
                                        <Input type="file" accept="video/*" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] || null)} />
                                        {fileMeta?.duration ? (
                                            <div className="text-[11px] font-mono opacity-60">
                                                {t(lang, 'beat.videoMeta', {
                                                    duration: fmtTime(fileMeta.duration),
                                                    w: String(fileMeta.width || 0),
                                                    h: String(fileMeta.height || 0),
                                                })}
                                            </div>
                                        ) : null}
                                    </div>
                                    <Button className="h-10 px-6" onClick={onGenerate} disabled={busy || !fileMeta?.duration}>
                                        {busy ? t(lang, 'beat.generating') : t(lang, 'beat.generateFromUpload')}
                                    </Button>
                                </div>

                                {fileUrl && (
                                    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-xs font-mono opacity-60">{t(lang, 'beat.preview')}</div>
                                            <Button
                                                variant="secondary"
                                                className="h-9 text-xs"
                                                onClick={() => void analyzeCuts()}
                                                disabled={cutsBusy || !fileMeta?.duration}
                                            >
                                                {cutsBusy ? t(lang, 'beat.visionRunning') : t(lang, 'beat.visionRun')}
                                            </Button>
                                        </div>
                                        <div className="mt-3">
                                            <video src={fileUrl} controls playsInline className="w-full rounded-xl border border-[var(--panel-border)]" />
                                        </div>
                                    </div>
                                )}

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <div className="text-xs font-mono opacity-60">{t(lang, 'beat.localTitle')}</div>
                                        <Input value={localTitle} onChange={(e) => setLocalTitle(e.target.value)} placeholder={t(lang, 'beat.localTitlePh')} disabled={busy} />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-xs font-mono opacity-60">{t(lang, 'beat.localDesc')}</div>
                                        <Input
                                            value={localDescription}
                                            onChange={(e) => setLocalDescription(e.target.value)}
                                            placeholder={t(lang, 'beat.localDescPh')}
                                            disabled={busy}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs font-mono opacity-60">{t(lang, 'beat.localTranscript')}</div>
                                    <textarea
                                        value={localTranscript}
                                        onChange={(e) => setLocalTranscript(e.target.value)}
                                        placeholder={t(lang, 'beat.localTranscriptPh')}
                                        className="min-h-28 w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4 text-sm text-[var(--foreground)] outline-none focus-visible:border-[var(--accent)]"
                                        disabled={busy}
                                        dir={rtl ? 'rtl' : 'ltr'}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4">
                            <div className="text-sm font-semibold">
                                <span className="ultimate-silver">ULTIMATE</span>
                                <span className="opacity-70"> · </span>
                                {t(lang, 'beat.aiPrefsTitle')}
                            </div>
                            <div className="mt-1 text-xs opacity-65">{t(lang, 'beat.aiPrefsHint')}</div>
                            <div className="mt-4 space-y-4">
                                <ToggleRow
                                    label={t(lang, 'settings.aiInsights')}
                                    description={t(lang, 'settings.aiInsightsDesc')}
                                    enabled={settings.aiInsightsEnabled && !locked}
                                    onToggle={() => updateSettings({ aiInsightsEnabled: !settings.aiInsightsEnabled })}
                                    disabled={locked}
                                    rtl={rtl}
                                />
                                <ToggleRow
                                    label={t(lang, 'settings.aiFix')}
                                    description={t(lang, 'settings.aiFixDesc')}
                                    enabled={settings.aiFixEnabled && !locked}
                                    onToggle={() => updateSettings({ aiFixEnabled: !settings.aiFixEnabled })}
                                    disabled={locked}
                                    rtl={rtl}
                                />
                                <ToggleRow
                                    label={t(lang, 'settings.aiUpscale')}
                                    description={t(lang, 'settings.aiUpscaleDesc')}
                                    enabled={settings.upscaleEnabled && !locked}
                                    onToggle={() => updateSettings({ upscaleEnabled: !settings.upscaleEnabled })}
                                    disabled={locked}
                                    rtl={rtl}
                                />
                            </div>
                        </div>

                        {locked && (
                            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div className="text-sm text-[var(--foreground)] opacity-80">{t(lang, 'beat.locked')}</div>
                                <Link href="/subscriptions">
                                    <Button className="h-9 text-xs">{t(lang, 'beat.upgrade')}</Button>
                                </Link>
                            </div>
                        )}

                        {error && (
                            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
                                {error}
                            </div>
                        )}
                    </div>
                </Card>

                {data && (
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card className="rounded-3xl p-6" spotlight={false}>
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="text-xs font-mono opacity-60">{t(lang, 'beat.sectionBeats')}</div>
                                    <div className="mt-2 text-lg font-semibold">{data.title || '—'}</div>
                                    {typeof data.duration_seconds === 'number' && data.duration_seconds > 0 && (
                                        <div className="mt-1 text-xs opacity-60">{fmtTime(data.duration_seconds)}</div>
                                    )}
                                    {thumbBusy && thumbProgress && (
                                        <div className="mt-2 text-[11px] font-mono opacity-60">
                                            {t(lang, 'beat.thumbsProgress', {
                                                done: String(thumbProgress.done),
                                                total: String(thumbProgress.total),
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2 flex-wrap justify-end">
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
                                    <Button
                                        variant="secondary"
                                        className="h-9 text-xs"
                                        onClick={() => downloadText('shotlist.md', data.exports?.shotlist_md || '')}
                                        disabled={!data.exports?.shotlist_md}
                                    >
                                        {t(lang, 'beat.downloadShotlist')}
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        className="h-9 text-xs"
                                        onClick={() => downloadText('broll.txt', data.exports?.broll_prompts || '')}
                                        disabled={!data.exports?.broll_prompts}
                                    >
                                        {t(lang, 'beat.downloadBroll')}
                                    </Button>
                                </div>
                            </div>

                            {mode === 'upload' && cuts.length > 0 && (
                                <div className="mt-5 rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-semibold">
                                            <span className="ultimate-silver">BEAT</span>
                                            <span className="opacity-70"> · </span>
                                            {t(lang, 'beat.visionTitle')}
                                        </div>
                                        <div className="text-[11px] font-mono opacity-60">{t(lang, 'beat.visionHint')}</div>
                                    </div>
                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                        {cuts.slice(0, 12).map((c, idx) => (
                                            <div
                                                key={`${c.time_sec}-${idx}`}
                                                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] overflow-hidden"
                                            >
                                                <Image
                                                    src={c.thumbnail_data_url}
                                                    alt=""
                                                    width={520}
                                                    height={292}
                                                    unoptimized
                                                    className="h-28 w-full object-cover"
                                                />
                                                <div className="p-3 flex items-center justify-between gap-3">
                                                    <div className="text-xs font-mono opacity-70">{fmtTime(c.time_sec)}</div>
                                                    <div className="text-[11px] font-mono opacity-60">{c.score.toFixed(2)}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-5 space-y-3">
                                {(data.beats || []).slice(0, 24).map((b, idx) => (
                                    <div key={idx} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4">
                                        {mode === 'upload' && thumbs[String(idx)] && (
                                            <Image
                                                src={thumbs[String(idx)]}
                                                alt=""
                                                width={520}
                                                height={292}
                                                unoptimized
                                                className="mb-3 h-36 w-full rounded-xl object-cover"
                                            />
                                        )}
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-semibold">
                                                <span className="ultimate-silver">BEAT</span>
                                                <span className="opacity-70"> · </span>
                                                {b.label || `#${idx + 1}`}
                                            </div>
                                            <div className="text-[11px] font-mono opacity-65">
                                                {fmtTime(b.start_sec)} → {fmtTime(b.end_sec)}
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
                                                    {fmtTime(s.start_sec || 0)} → {fmtTime(s.end_sec || 0)}
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

            {/* Hidden helpers (single instance for deterministic thumbnails) */}
            <video ref={videoRef} className="hidden" playsInline muted />
        </main>
    );
}

function ToggleRow({
    label,
    description,
    enabled,
    onToggle,
    disabled,
    rtl,
}: {
    label: string;
    description: string;
    enabled: boolean;
    onToggle: () => void;
    disabled?: boolean;
    rtl?: boolean;
}) {
    return (
        <div className={`flex items-center justify-between gap-4 ${rtl ? 'flex-row-reverse' : ''}`}>
            <div className={rtl ? 'text-right' : ''}>
                <div className="text-sm font-semibold text-[var(--foreground)]">{label}</div>
                <div className="text-xs text-[var(--foreground)] opacity-60 mt-1">{description}</div>
            </div>
            <button
                type="button"
                disabled={disabled}
                onClick={onToggle}
                className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-all ${
                    enabled ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--panel-border)] bg-[var(--panel)]'
                } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
                <span
                    className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-[var(--foreground)] shadow transition-all ${
                        enabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                />
            </button>
        </div>
    );
}
