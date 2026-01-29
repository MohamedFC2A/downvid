'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { useSettings } from '@/hooks/useSettings';
import { t } from '@/lib/i18n';
import { getSupabaseClient } from '@/lib/supabase';

const POLL_INTERVAL_MS = 3000;

type UpscaleButtonProps = {
    videoUrl: string;
    fileToken?: string;
    disabled?: boolean;
};

export function UpscaleButton({ videoUrl, fileToken, disabled }: UpscaleButtonProps) {
    const { settings } = useSettings();
    const lang = settings.language;
    const [status, setStatus] = useState<'idle' | 'starting' | 'processing' | 'succeeded' | 'failed'>('idle');
    const [logs, setLogs] = useState<string[]>([]);
    const [predictionId, setPredictionId] = useState<string | null>(null);
    const [outputUrl, setOutputUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const timersRef = useRef<number[]>([]);
    const pollingRef = useRef<number | null>(null);

    const apiBase = useMemo(() => {
        return process.env.NEXT_PUBLIC_BACKEND_URL
            ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api`
            : '/api';
    }, []);

    useEffect(() => {
        return () => {
            timersRef.current.forEach((timer) => window.clearTimeout(timer));
            timersRef.current = [];
            if (pollingRef.current) {
                window.clearInterval(pollingRef.current);
            }
        };
    }, []);

    useEffect(() => {
        setStatus('idle');
        setLogs([]);
        setPredictionId(null);
        setOutputUrl(null);
        setError(null);
        if (pollingRef.current) {
            window.clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    }, [videoUrl, fileToken]);

    useEffect(() => {
        if (!predictionId || status !== 'processing') return;

        pollingRef.current = window.setInterval(async () => {
            try {
                const supabase = getSupabaseClient();
                const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
                const headers: Record<string, string> | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
                const res = await fetch(`${apiBase}/upscale/status/${predictionId}`, { headers });
                if (!res.ok) return;
                const data = await res.json();
                if (data.rawStatus === 'failed' || data.rawStatus === 'canceled') {
                    setStatus('failed');
                    setError(data.error || t(lang, 'upscale.failed'));
                    setLogs((prev) => [...prev, `> ${t(lang, 'upscale.log.error')}`]);
                    if (pollingRef.current) {
                        window.clearInterval(pollingRef.current);
                        pollingRef.current = null;
                    }
                    return;
                }
                if (data.status === 'succeeded') {
                    setStatus('succeeded');
                    setOutputUrl(data.output || null);
                    setLogs((prev) => [...prev, `> ${t(lang, 'upscale.log.complete')}`]);
                    if (pollingRef.current) {
                        window.clearInterval(pollingRef.current);
                        pollingRef.current = null;
                    }
                }
            } catch (err) {
                setStatus('failed');
                setError(err instanceof Error ? err.message : t(lang, 'upscale.failed'));
                setLogs((prev) => [...prev, `> ${t(lang, 'upscale.log.error')}`]);
                if (pollingRef.current) {
                    window.clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
            }
        }, POLL_INTERVAL_MS);

        return () => {
            if (pollingRef.current) {
                window.clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [apiBase, predictionId, status, lang]);

    const startUpscale = async () => {
        if ((!fileToken && !videoUrl) || status === 'processing') return;
        setStatus('starting');
        setLogs([]);
        setOutputUrl(null);
        setPredictionId(null);
        setError(null);

        const logLines = [
            `> ${t(lang, 'upscale.log.connecting')}`,
            `> ${t(lang, 'upscale.log.upscaling')}`,
            `> ${t(lang, 'upscale.log.enhancing')}`,
        ];

        logLines.forEach((line, index) => {
            const timer = window.setTimeout(() => {
                setLogs((prev) => [...prev, line]);
            }, index * 350);
            timersRef.current.push(timer);
        });

        try {
            const supabase = getSupabaseClient();
            const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;

            const res = await fetch(`${apiBase}/upscale`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    ...(fileToken ? { fileToken } : { videoUrl }),
                    model: settings.defaultUpscaleModel,
                }),
            });

            if (!res.ok) {
                const detail = await res.json().catch(() => null);
                const msg = detail?.detail || detail?.error || `Failed to start upscale (${res.status})`;
                throw new Error(msg);
            }

            const data = await res.json();
            setPredictionId(data.predictionId);
            setStatus('processing');
            setLogs((prev) => [...prev, `> ${t(lang, 'upscale.log.predictionId', { id: data.predictionId })}`]);
        } catch (err) {
            setStatus('failed');
            setError(err instanceof Error ? err.message : t(lang, 'upscale.failed'));
            setLogs((prev) => [...prev, `> ${t(lang, 'upscale.log.error')}`]);
        }
    };

    return (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">{t(lang, 'upscale.title')}</div>
                    <div className="text-xs text-[var(--foreground)] opacity-60">
                        {t(lang, 'upscale.model')}: {settings.defaultUpscaleModel === 'real-esrgan' ? 'Real-ESRGAN' : 'Video-Enhance'}
                    </div>
                    {!fileToken && (
                        <div className="text-[11px] text-[var(--foreground)] opacity-60 mt-1">
                            {t(lang, 'upscale.unlockHint')}
                        </div>
                    )}
                </div>
                <Button
                    onClick={startUpscale}
                    disabled={disabled || !videoUrl || status === 'processing' || status === 'starting'}
                    className="h-10 px-5 text-sm font-semibold bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 border border-[var(--panel-border)]"
                >
                    {t(lang, 'upscale.cta')}
                </Button>
            </div>

            <AnimatePresence initial={false}>
                {logs.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                        className="rounded-xl border border-[var(--panel-border)] bg-[var(--deep)] px-4 py-3 font-mono text-xs text-[var(--foreground)] opacity-80 space-y-1"
                    >
                        {logs.map((line, idx) => (
                            <div key={`${line}-${idx}`}>{line}</div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {status === 'failed' && error && (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs text-red-700">
                    {error}
                </div>
            )}

            {status === 'succeeded' && outputUrl && (
                <button
                    onClick={() => {
                        const link = document.createElement('a');
                        link.href = outputUrl;
                        link.setAttribute('download', 'downvid-4k.mp4');
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                    }}
                    className="w-full rounded-xl border border-[var(--panel-border)] bg-[var(--deep)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] hover:opacity-90"
                >
                    {t(lang, 'upscale.download4k')}
                </button>
            )}
        </div>
    );
}
