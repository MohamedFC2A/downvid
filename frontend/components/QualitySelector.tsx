'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { t } from '@/lib/i18n';
import type { AppLanguage } from '@/lib/settings';
import { useMemo, useState } from 'react';

export interface VideoFormat {
    format_id: string;
    resolution: string;
    filesize_str: string;
    note: string;
    extension: string;
    height?: number;
    fps?: number;
    vcodec?: string;
    acodec?: string;
    abr?: number;
}

interface QualitySelectorProps {
    availableFormats: VideoFormat[];
    audioFormats: VideoFormat[];
    mode: 'video' | 'audio';
    selectedId: string | null;
    language: AppLanguage;
    onSelect: (formatId: string, mode: 'video' | 'audio') => void;
    onModeChange: (mode: 'video' | 'audio') => void;
}

export function QualitySelector({
    availableFormats,
    audioFormats,
    mode,
    selectedId,
    language,
    onSelect,
    onModeChange,
}: QualitySelectorProps) {
    function parseBytes(str: string): number | null {
        const raw = (str || '').trim();
        if (!raw) return null;
        const m = raw.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
        if (!m) return null;
        const n = Number(m[1]);
        if (!Number.isFinite(n) || n <= 0) return null;
        const unit = m[2].toUpperCase();
        const pow = unit === 'B' ? 0 : unit === 'KB' ? 1 : unit === 'MB' ? 2 : unit === 'GB' ? 3 : 4;
        return Math.floor(n * Math.pow(1024, pow));
    }

    const formats = useMemo(() => {
        const list = mode === 'video' ? [...availableFormats] : [...audioFormats];
        if (mode === 'audio') {
            list.sort((a, b) => {
                const abr = (b.abr || 0) - (a.abr || 0);
                if (abr !== 0) return abr;
                return (parseBytes(b.filesize_str || '') || 0) - (parseBytes(a.filesize_str || '') || 0);
            });
            return list;
        }
        list.sort((a, b) => {
            const h = (b.height || 0) - (a.height || 0);
            if (h !== 0) return h;
            const fps = (b.fps || 0) - (a.fps || 0);
            if (fps !== 0) return fps;
            return (parseBytes(b.filesize_str || '') || 0) - (parseBytes(a.filesize_str || '') || 0);
        });
        return list;
    }, [availableFormats, audioFormats, mode]);
    const [showDetails, setShowDetails] = useState(false);

    const selectedFmt = useMemo(() => {
        if (!selectedId) return null;
        return formats.find((f) => f.format_id === selectedId) || null;
    }, [formats, selectedId]);

    const handleSelect = (id: string) => {
        onSelect(id, mode);
    };

    const targetHeights = useMemo(() => (mode === 'video' ? [2160, 1440, 1080, 720, 480, 360, 240] : []), [mode]);

    const getHeight = (fmt: VideoFormat): number | null => {
        if (typeof fmt.height === 'number' && fmt.height > 0) return fmt.height;
        const m = (fmt.resolution || '').match(/(\d{3,4})p/i);
        if (m) {
            const v = Number.parseInt(m[1], 10);
            return Number.isNaN(v) ? null : v;
        }
        if (/4k/i.test(fmt.resolution || '')) return 2160;
        if (/8k/i.test(fmt.resolution || '')) return 4320;
        return null;
    };

    const byHeight = useMemo(() => {
        const map = new Map<number, VideoFormat>();
        if (mode !== 'video') return map;
        for (const fmt of formats) {
            const h = getHeight(fmt);
            if (!h) continue;
            const cur = map.get(h);
            if (!cur) {
                map.set(h, fmt);
                continue;
            }
            // Prefer: higher fps, larger size, mp4 container.
            const fpsA = typeof fmt.fps === 'number' ? fmt.fps : 0;
            const fpsB = typeof cur.fps === 'number' ? cur.fps : 0;
            const sizeA = parseBytes(fmt.filesize_str || '') || 0;
            const sizeB = parseBytes(cur.filesize_str || '') || 0;
            const mp4A = (fmt.extension || '').toLowerCase() === 'mp4' ? 1 : 0;
            const mp4B = (cur.extension || '').toLowerCase() === 'mp4' ? 1 : 0;
            const scoreA = mp4A * 1_000_000_000 + fpsA * 1_000_000 + sizeA;
            const scoreB = mp4B * 1_000_000_000 + fpsB * 1_000_000 + sizeB;
            if (scoreA > scoreB) map.set(h, fmt);
        }
        return map;
    }, [formats, mode]);

    const listFormats = useMemo(() => {
        if (mode === 'audio') return formats;
        const extra = formats.filter((f) => {
            const h = getHeight(f);
            return !h || !targetHeights.includes(h);
        });
        // Put selected first in details view
        const sorted = [...extra];
        sorted.sort((a, b) => {
            const aSel = a.format_id === selectedId ? 1 : 0;
            const bSel = b.format_id === selectedId ? 1 : 0;
            if (aSel !== bSel) return bSel - aSel;
            return (getHeight(b) || 0) - (getHeight(a) || 0);
        });
        return sorted;
    }, [formats, mode, selectedId, targetHeights]);

    const labelForHeight = (h: number) => {
        if (h === 2160) return '2160p · 4K';
        if (h === 1440) return '1440p · 2K';
        return `${h}p`;
    };

    const codecShort = (fmt: VideoFormat) => {
        const v = (fmt.vcodec || '').split('.')[0] || '';
        const a = (fmt.acodec || '').split('.')[0] || '';
        const parts = [v, a].filter(Boolean).filter((x) => x !== 'none');
        return parts.join(' / ') || '—';
    };

    const hasDownloadLink = (fmt: VideoFormat | null | undefined) => Boolean(fmt?.format_id && String(fmt.format_id).trim().length > 0);

    const noAudio = (fmt: VideoFormat) => {
        if (mode !== 'video') return false;
        const a = (fmt.acodec || '').toLowerCase();
        return !a || a === 'none';
    };

    const noteLine = (fmt: VideoFormat) => {
        const parts = [codecShort(fmt)];
        if (fmt.note) parts.push(fmt.note);
        if (noAudio(fmt)) parts.push(t(language, 'quality.noAudio'));
        return parts.filter(Boolean).join(' • ');
    };

    const selectedSummary = useMemo(() => {
        if (!selectedFmt) return t(language, 'quality.selectedNone');
        const size = selectedFmt.filesize_str || 'Unknown';
        const ext = selectedFmt.extension || '—';
        const speed =
            mode === 'audio'
                ? typeof selectedFmt.abr === 'number' && selectedFmt.abr > 0
                    ? `${Math.round(selectedFmt.abr)}kbps`
                    : null
                : typeof selectedFmt.fps === 'number' && selectedFmt.fps > 0
                    ? `${Math.round(selectedFmt.fps)}fps`
                    : null;
        const parts = [selectedFmt.resolution, speed, size, ext].filter(Boolean);
        return `${t(language, 'quality.selected')}: ${parts.join(' • ')}`;
    }, [language, mode, selectedFmt]);

    return (
        <div className="w-full bg-[var(--deep)] border border-[var(--panel-border)] rounded-xl p-3 space-y-3">
            {/* Mode Switcher */}
            <div className="flex p-1 bg-[var(--panel)] rounded-lg border border-[var(--panel-border)]">
                <button
                    onClick={() => onModeChange('video')}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ease-out ${mode === 'video'
                        ? 'bg-[var(--foreground)] text-[var(--background)] shadow-md scale-[1.02]'
                        : 'text-[var(--foreground)] opacity-60 hover:opacity-90 hover:bg-[var(--accent-soft)]'
                        }`}
                >
                    {t(language, 'quality.video')}
                </button>
                <button
                    onClick={() => onModeChange('audio')}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ease-out ${mode === 'audio'
                        ? 'bg-[var(--foreground)] text-[var(--background)] shadow-md scale-[1.02]'
                        : 'text-[var(--foreground)] opacity-60 hover:opacity-90 hover:bg-[var(--accent-soft)]'
                        }`}
                >
                    {t(language, 'quality.audio')}
                </button>
            </div>

            {/* Quick picks (compact) */}
            {mode === 'video' && formats.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pr-1 pb-1">
                    {targetHeights.map((h) => {
                        const fmt = byHeight.get(h) || null;
                        const disabled = !fmt || !hasDownloadLink(fmt);
                        const selected = fmt?.format_id && selectedId === fmt.format_id;
                        return (
                            <button
                                key={`q-${h}`}
                                type="button"
                                disabled={disabled}
                                onClick={() => fmt && handleSelect(fmt.format_id)}
                                className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all duration-200 ease-out ${selected
                                        ? 'border-[var(--foreground)] bg-[var(--accent-soft)] text-[var(--foreground)] scale-105 shadow-sm'
                                        : disabled
                                            ? 'border-[var(--panel-border)] bg-[var(--panel)] text-[var(--foreground)] opacity-45 cursor-not-allowed'
                                            : 'border-[var(--panel-border)] bg-[var(--panel)] text-[var(--foreground)] opacity-80 hover:opacity-100 hover:scale-105 active:scale-95'
                                    }`}
                                title={
                                    disabled
                                        ? fmt
                                            ? t(language, 'quality.noLink')
                                            : t(language, 'quality.notAvailable')
                                        : [fmt?.filesize_str || '', fmt?.extension || '', noAudio(fmt as VideoFormat) ? t(language, 'quality.noAudio') : '']
                                            .filter(Boolean)
                                            .join(' ')
                                            .trim()
                                }
                            >
                                <span>{labelForHeight(h)}</span>
                                <span className="ml-2 font-mono opacity-70">{disabled ? '—' : (fmt?.filesize_str || 'N/A')}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Details toggle */}
            <div className="flex items-center justify-between">
                <div className="text-[11px] text-[var(--foreground)] opacity-65 font-mono" title={selectedFmt ? noteLine(selectedFmt) : ''}>
                    {selectedSummary}
                </div>
                <button
                    type="button"
                    onClick={() => setShowDetails((v) => !v)}
                    className="text-[11px] font-semibold text-[var(--foreground)] opacity-80 hover:opacity-100"
                >
                    {showDetails ? t(language, 'quality.less') : t(language, 'quality.more')}
                </button>
            </div>

            {/* Compact list (small rows) */}
            <div className="max-h-[220px] overflow-y-auto pr-1">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={mode}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-2"
                    >
                        {formats.length === 0 ? (
                            <div className="text-center text-[var(--foreground)] opacity-60 py-8 text-sm italic">
                                {t(language, 'quality.none', {
                                    mode: t(language, mode === 'video' ? 'quality.video' : 'quality.audio'),
                                })}
                            </div>
                        ) : (
                            <>
                                {showDetails ? (
                                    <div className="rounded-lg border border-[var(--panel-border)] overflow-hidden">
                                        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-mono text-[var(--foreground)] opacity-60 bg-[var(--panel)]">
                                            <div className="col-span-4">{t(language, 'tool.quality')}</div>
                                            <div className="col-span-2">{t(language, 'quality.ext')}</div>
                                            <div className="col-span-2">{t(language, 'quality.size')}</div>
                                            <div className="col-span-1">{mode === 'audio' ? t(language, 'quality.kbps') : t(language, 'quality.fps')}</div>
                                            <div className="col-span-3">{t(language, 'quality.codec')}</div>
                                        </div>
                                        <div className="max-h-[260px] overflow-y-auto">
                                            {(mode === 'video' ? [...formats] : [...formats]).slice(0, 80).map((fmt) => {
                                                const selected = fmt.format_id === selectedId;
                                                const disabled = !hasDownloadLink(fmt);
                                                const fpsOrKbps =
                                                    mode === 'audio'
                                                        ? typeof fmt.abr === 'number' && fmt.abr > 0
                                                            ? `${Math.round(fmt.abr)}`
                                                            : '—'
                                                        : typeof fmt.fps === 'number' && fmt.fps > 0
                                                            ? `${Math.round(fmt.fps)}`
                                                            : '—';
                                                return (
                                                    <button
                                                        key={`row-${fmt.format_id}`}
                                                        type="button"
                                                        disabled={disabled}
                                                        onClick={() => hasDownloadLink(fmt) && handleSelect(fmt.format_id)}
                                                        className={`w-full grid grid-cols-12 gap-2 px-3 py-2 text-left text-xs border-t border-[var(--panel-border)] ${disabled
                                                                ? 'bg-[var(--deep)] opacity-45 cursor-not-allowed'
                                                                : selected
                                                                    ? 'bg-[var(--accent-soft)]'
                                                                    : 'bg-[var(--deep)] hover:bg-[var(--panel)]'
                                                            }`}
                                                        title={disabled ? t(language, 'quality.noLink') : noteLine(fmt)}
                                                    >
                                                        <div className="col-span-4 font-semibold text-[var(--foreground)]">
                                                            {fmt.resolution}
                                                            {noAudio(fmt) ? <span className="ml-2 font-normal opacity-60">• {t(language, 'quality.noAudio')}</span> : null}
                                                        </div>
                                                        <div className="col-span-2 font-mono text-[var(--foreground)] opacity-80">{fmt.extension || '—'}</div>
                                                        <div className="col-span-2 font-mono text-[var(--foreground)] opacity-80">{fmt.filesize_str || 'Unknown'}</div>
                                                        <div className="col-span-1 font-mono text-[var(--foreground)] opacity-70">{fpsOrKbps}</div>
                                                        <div className="col-span-3 font-mono text-[var(--foreground)] opacity-70">{codecShort(fmt)}</div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {listFormats.slice(0, 10).map((fmt) => {
                                            const selected = fmt.format_id === selectedId;
                                            const disabled = !hasDownloadLink(fmt);
                                            const fpsOrKbps =
                                                mode === 'audio'
                                                    ? typeof fmt.abr === 'number' && fmt.abr > 0
                                                        ? `${Math.round(fmt.abr)}kbps`
                                                        : ''
                                                    : typeof fmt.fps === 'number' && fmt.fps > 0
                                                        ? `${Math.round(fmt.fps)}fps`
                                                        : '';
                                            return (
                                                <button
                                                    key={`mini-${fmt.format_id}`}
                                                    type="button"
                                                    disabled={disabled}
                                                    onClick={() => hasDownloadLink(fmt) && handleSelect(fmt.format_id)}
                                                    className={`w-full rounded-lg border px-3 py-2 text-left transition-all ${disabled
                                                            ? 'border-[var(--panel-border)] bg-[var(--panel)] opacity-45 cursor-not-allowed'
                                                            : selected
                                                                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                                                                : 'border-[var(--panel-border)] bg-[var(--panel)] hover:opacity-95'
                                                        }`}
                                                    title={disabled ? t(language, 'quality.noLink') : noteLine(fmt)}
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="text-sm font-semibold text-[var(--foreground)]">
                                                            {fmt.resolution}
                                                            {fpsOrKbps ? <span className="ml-2 text-[11px] font-mono opacity-60">{fpsOrKbps}</span> : null}
                                                        </div>
                                                        <div className="text-[11px] font-mono text-[var(--foreground)] opacity-70">
                                                            {fmt.filesize_str || 'Unknown'} • {fmt.extension || '—'}
                                                        </div>
                                                    </div>
                                                    {(fmt.vcodec || fmt.acodec || fmt.note) && (
                                                        <div className="mt-1 text-[11px] font-mono text-[var(--foreground)] opacity-60">
                                                            {noteLine(fmt)}
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
