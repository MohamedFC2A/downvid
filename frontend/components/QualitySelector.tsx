'use client';

import { motion, AnimatePresence } from 'framer-motion';

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
    onSelect: (formatId: string, mode: 'video' | 'audio') => void;
    onModeChange: (mode: 'video' | 'audio') => void;
}

export function QualitySelector({
    availableFormats,
    audioFormats,
    mode,
    selectedId,
    onSelect,
    onModeChange,
}: QualitySelectorProps) {
    const formats = mode === 'video' ? availableFormats : audioFormats;

    const handleSelect = (id: string) => {
        onSelect(id, mode);
    };

    return (
        <div className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-4 space-y-4">
            {/* Mode Switcher */}
            <div className="flex p-1 bg-black/40 rounded-lg border border-white/10">
                <button
                    onClick={() => onModeChange('video')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'video'
                            ? 'bg-white text-black shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                >
                    Video
                </button>
                <button
                    onClick={() => onModeChange('audio')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'audio'
                            ? 'bg-white text-black shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                >
                    Audio
                </button>
            </div>

            {/* Format List */}
            <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={mode}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-2"
                    >
                        {formats.length === 0 ? (
                            <div className="text-center text-zinc-500 py-4 text-sm">
                                No {mode} formats available
                            </div>
                        ) : (
                            formats.map((fmt) => (
                                <button
                                    key={fmt.format_id}
                                    onClick={() => handleSelect(fmt.format_id)}
                                    className={`w-full flex flex-col gap-2 px-4 py-3 rounded-lg text-sm transition-all border ${selectedId === fmt.format_id
                                            ? 'bg-white text-black border-transparent font-medium'
                                            : 'bg-black/40 text-zinc-200 border-white/10 hover:border-white/30 hover:bg-white/5'
                                        }`}
                                >
                                    <div className="w-full flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base font-semibold">{fmt.resolution}</span>
                                            {fmt.extension && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${selectedId === fmt.format_id
                                                        ? 'bg-black/10 text-black/70'
                                                        : 'bg-white/10 text-zinc-400'
                                                    }`}>
                                                    {fmt.extension.toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <span className={selectedId === fmt.format_id ? 'text-black/70' : 'text-zinc-500'}>
                                            {fmt.filesize_str}
                                        </span>
                                    </div>
                                    <div className={`w-full text-left text-xs ${selectedId === fmt.format_id ? 'text-black/60' : 'text-zinc-500'}`}>
                                        {[fmt.note, fmt.vcodec, fmt.acodec]
                                            .filter((val) => val && val !== "none")
                                            .join(" • ") || "Standard"}
                                    </div>
                                </button>
                            ))
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
