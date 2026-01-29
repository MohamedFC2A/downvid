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
            <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 pr-2">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={mode}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    >
                        {formats.length === 0 ? (
                            <div className="col-span-full text-center text-zinc-500 py-8 text-sm italic">
                                No {mode} formats detected for this link.
                            </div>
                        ) : (
                            formats.map((fmt) => (
                                <button
                                    key={fmt.format_id}
                                    onClick={() => handleSelect(fmt.format_id)}
                                    className={`relative group flex flex-col justify-between p-4 rounded-xl text-left transition-all duration-300 border backdrop-blur-md ${selectedId === fmt.format_id
                                        ? 'bg-white/10 border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.15)] scale-[1.02]'
                                        : 'bg-black/20 border-white/5 hover:bg-white/5 hover:border-white/20'
                                        }`}
                                >
                                    <div className="w-full flex justify-between items-start mb-2">
                                        <div className="flex flex-col">
                                            <span className={`text-lg font-bold tracking-tight ${selectedId === fmt.format_id ? 'text-white' : 'text-zinc-200'}`}>
                                                {fmt.resolution}
                                            </span>
                                            {fmt.extension && (
                                                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono mt-0.5">
                                                    {fmt.extension}
                                                </span>
                                            )}
                                        </div>
                                        {selectedId === fmt.format_id && (
                                            <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_cyan]"></div>
                                        )}
                                    </div>

                                    <div className="w-full border-t border-white/5 pt-3 mt-1 flex justify-between items-center text-xs">
                                        <span className={`font-mono ${selectedId === fmt.format_id ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                            {fmt.filesize_str || 'N/A'}
                                        </span>
                                        {[fmt.vcodec, fmt.acodec].some(c => c && c !== 'none') && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-zinc-400">
                                                {mode === 'video' ? 'HD' : 'HQ'}
                                            </span>
                                        )}
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
