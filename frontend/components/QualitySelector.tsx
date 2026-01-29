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
    const formats = mode === 'video' ? availableFormats : audioFormats;
    const [showDetails, setShowDetails] = useState(false);

    const handleSelect = (id: string) => {
        onSelect(id, mode);
    };

    const targetHeights = mode === 'video' ? [2160, 1440, 1080, 720, 480, 360, 240] : [];

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
            if (!map.has(h)) map.set(h, fmt);
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
    }, [formats, mode, selectedId]);

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

    return (
        <div className="w-full bg-[var(--deep)] border border-[var(--panel-border)] rounded-xl p-3 space-y-3">
            {/* Mode Switcher */}
            <div className="flex p-1 bg-[var(--panel)] rounded-lg border border-[var(--panel-border)]">
                <button
                    onClick={() => onModeChange('video')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'video'
                        ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                        : 'text-[var(--foreground)] opacity-60 hover:opacity-90'
                        }`}
                >
                    {t(language, 'quality.video')}
                </button>
                <button
                    onClick={() => onModeChange('audio')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'audio'
                        ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                        : 'text-[var(--foreground)] opacity-60 hover:opacity-90'
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
                        const disabled = !fmt;
                        const selected = fmt?.format_id && selectedId === fmt.format_id;
                        return (
                            <button
                                key={`q-${h}`}
                                type="button"
                                disabled={disabled}
                                onClick={() => fmt && handleSelect(fmt.format_id)}
                                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                                    selected
                                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)]'
                                        : disabled
                                            ? 'border-[var(--panel-border)] bg-[var(--panel)] text-[var(--foreground)] opacity-45 cursor-not-allowed'
                                            : 'border-[var(--panel-border)] bg-[var(--panel)] text-[var(--foreground)] opacity-80 hover:opacity-100'
                                }`}
                                title={disabled ? t(language, 'quality.notAvailable') : `${fmt?.filesize_str || ''} ${fmt?.extension || ''}`.trim()}
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
                <div className="text-[11px] text-[var(--foreground)] opacity-60 font-mono">
                    {selectedId ? `ID: ${selectedId}` : ''}
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
                                            <div className="col-span-1">{t(language, 'quality.fps')}</div>
                                            <div className="col-span-3">{t(language, 'quality.codec')}</div>
                                        </div>
                                        <div className="max-h-[260px] overflow-y-auto">
                                            {(mode === 'video' ? [...formats] : [...formats]).slice(0, 80).map((fmt) => {
                                                const selected = fmt.format_id === selectedId;
                                                const fps = typeof fmt.fps === 'number' && fmt.fps > 0 ? `${Math.round(fmt.fps)}` : '—';
                                                return (
                                                    <button
                                                        key={`row-${fmt.format_id}`}
                                                        type="button"
                                                        onClick={() => handleSelect(fmt.format_id)}
                                                        className={`w-full grid grid-cols-12 gap-2 px-3 py-2 text-left text-xs border-t border-[var(--panel-border)] ${
                                                            selected ? 'bg-[var(--accent-soft)]' : 'bg-[var(--deep)] hover:bg-[var(--panel)]'
                                                        }`}
                                                        title={fmt.note || ''}
                                                    >
                                                        <div className="col-span-4 font-semibold text-[var(--foreground)]">
                                                            {fmt.resolution}
                                                            {fmt.note ? <span className="ml-2 font-normal opacity-60">• {fmt.note}</span> : null}
                                                        </div>
                                                        <div className="col-span-2 font-mono text-[var(--foreground)] opacity-80">{fmt.extension || '—'}</div>
                                                        <div className="col-span-2 font-mono text-[var(--foreground)] opacity-80">{fmt.filesize_str || 'Unknown'}</div>
                                                        <div className="col-span-1 font-mono text-[var(--foreground)] opacity-70">{fps}</div>
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
                                            const fps = typeof fmt.fps === 'number' && fmt.fps > 0 ? `${Math.round(fmt.fps)}fps` : '';
                                            return (
                                                <button
                                                    key={`mini-${fmt.format_id}`}
                                                    type="button"
                                                    onClick={() => handleSelect(fmt.format_id)}
                                                    className={`w-full rounded-lg border px-3 py-2 text-left transition-all ${
                                                        selected
                                                            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                                                            : 'border-[var(--panel-border)] bg-[var(--panel)] hover:opacity-95'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="text-sm font-semibold text-[var(--foreground)]">
                                                            {fmt.resolution}
                                                            {fps ? <span className="ml-2 text-[11px] font-mono opacity-60">{fps}</span> : null}
                                                        </div>
                                                        <div className="text-[11px] font-mono text-[var(--foreground)] opacity-70">
                                                            {fmt.filesize_str || 'Unknown'} • {fmt.extension || '—'}
                                                        </div>
                                                    </div>
                                                    {(fmt.vcodec || fmt.acodec || fmt.note) && (
                                                        <div className="mt-1 text-[11px] font-mono text-[var(--foreground)] opacity-60">
                                                            {[codecShort(fmt), fmt.note].filter(Boolean).join(' • ')}
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
