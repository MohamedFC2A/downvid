'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { t } from '@/lib/i18n';
import type { AppLanguage } from '@/lib/settings';

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

    const handleSelect = (id: string) => {
        onSelect(id, mode);
    };

    const targetHeights = mode === 'video'
        ? [2160, 1440, 1080, 720, 480, 360, 240]
        : [];

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

    const byHeight = new Map<number, VideoFormat>();
    if (mode === 'video') {
        // Pick best candidate per height (backend is already sorted desc).
        for (const fmt of formats) {
            const h = getHeight(fmt);
            if (!h) continue;
            if (!byHeight.has(h)) byHeight.set(h, fmt);
        }
    }

    const extraFormats = mode === 'video'
        ? formats.filter((f) => {
            const h = getHeight(f);
            return !h || !targetHeights.includes(h);
        })
        : formats;

    const labelForHeight = (h: number) => {
        if (h === 2160) return '2160p · 4K';
        if (h === 1440) return '1440p · 2K';
        return `${h}p`;
    };

    return (
        <div className="w-full bg-[var(--deep)] border border-[var(--panel-border)] rounded-xl p-4 space-y-4">
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

            {/* Format List */}
            <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 pr-2">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={mode}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                    >
                        {formats.length === 0 ? (
                            <div className="text-center text-[var(--foreground)] opacity-60 py-8 text-sm italic">
                                {t(language, 'quality.none', {
                                    mode: t(language, mode === 'video' ? 'quality.video' : 'quality.audio'),
                                })}
                            </div>
                        ) : (
                            <>
                                {mode === 'video' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {targetHeights.map((h) => {
                                            const fmt = byHeight.get(h) || null;
                                            const disabled = !fmt;
                                            const id = fmt?.format_id || `disabled-${h}`;
                                            return (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    disabled={disabled}
                                                    onClick={() => fmt && handleSelect(fmt.format_id)}
                                                    className={`relative group flex flex-col justify-between p-4 rounded-xl text-left transition-all duration-300 border ${selectedId === fmt?.format_id
                                                        ? 'bg-[var(--accent-soft)] border-[var(--accent)] scale-[1.02]'
                                                        : disabled
                                                            ? 'bg-[var(--panel)] border-[var(--panel-border)] opacity-45 cursor-not-allowed'
                                                            : 'bg-[var(--panel)] border-[var(--panel-border)] hover:opacity-90'
                                                        }`}
                                                >
                                                    <div className="w-full flex justify-between items-start mb-2">
                                                        <div className="flex flex-col">
                                                            <span className="text-lg font-bold tracking-tight text-[var(--foreground)]">
                                                                {labelForHeight(h)}
                                                            </span>
                                                            <span className="text-[10px] uppercase tracking-wider text-[var(--foreground)] opacity-60 font-mono mt-0.5">
                                                                {disabled ? t(language, 'quality.notAvailable') : fmt?.extension}
                                                            </span>
                                                        </div>
                                                        {selectedId === fmt?.format_id && (
                                                            <div className="h-2 w-2 rounded-full bg-[var(--accent)]"></div>
                                                        )}
                                                    </div>

                                                    <div className="w-full border-t border-[var(--panel-border)] pt-3 mt-1 flex justify-between items-center text-xs">
                                                        <span className="font-mono text-[var(--foreground)] opacity-70">
                                                            {disabled ? '—' : (fmt?.filesize_str || 'N/A')}
                                                        </span>
                                                        {!disabled && [fmt?.vcodec, fmt?.acodec].some(c => c && c !== 'none') && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--foreground)] opacity-80">
                                                                {mode === 'video' ? 'HD' : 'HQ'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {extraFormats.map((fmt) => (
                                        <button
                                            key={fmt.format_id}
                                            onClick={() => handleSelect(fmt.format_id)}
                                            className={`relative group flex flex-col justify-between p-4 rounded-xl text-left transition-all duration-300 border ${selectedId === fmt.format_id
                                                ? 'bg-[var(--accent-soft)] border-[var(--accent)] scale-[1.02]'
                                                : 'bg-[var(--panel)] border-[var(--panel-border)] hover:opacity-90'
                                                }`}
                                        >
                                            <div className="w-full flex justify-between items-start mb-2">
                                                <div className="flex flex-col">
                                                    <span className={`text-lg font-bold tracking-tight ${selectedId === fmt.format_id ? 'text-[var(--foreground)]' : 'text-[var(--foreground)] opacity-90'}`}>
                                                        {fmt.resolution}
                                                    </span>
                                                    {fmt.extension && (
                                                        <span className="text-[10px] uppercase tracking-wider text-[var(--foreground)] opacity-60 font-mono mt-0.5">
                                                            {fmt.extension}
                                                        </span>
                                                    )}
                                                </div>
                                                {selectedId === fmt.format_id && (
                                                    <div className="h-2 w-2 rounded-full bg-[var(--accent)]"></div>
                                                )}
                                            </div>

                                            <div className="w-full border-t border-[var(--panel-border)] pt-3 mt-1 flex justify-between items-center text-xs">
                                                <span className={`font-mono ${selectedId === fmt.format_id ? 'text-[var(--foreground)] opacity-85' : 'text-[var(--foreground)] opacity-60'}`}>
                                                    {fmt.filesize_str || 'N/A'}
                                                </span>
                                                {[fmt.vcodec, fmt.acodec].some(c => c && c !== 'none') && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--foreground)] opacity-80">
                                                        {mode === 'video' ? 'HD' : 'HQ'}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
