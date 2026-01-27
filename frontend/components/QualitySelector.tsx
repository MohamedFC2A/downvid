'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface VideoFormat {
    format_id: string;
    resolution: string;
    filesize_str: string;
    note: string;
    extension: string;
}

interface QualitySelectorProps {
    availableFormats: VideoFormat[];
    audioFormats: VideoFormat[];
    onSelect: (formatId: string, mode: 'video' | 'audio') => void;
}

export function QualitySelector({ availableFormats, audioFormats, onSelect }: QualitySelectorProps) {
    const [mode, setMode] = useState<'video' | 'audio'>('video');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const handleSelect = (id: string) => {
        setSelectedId(id);
        onSelect(id, mode);
    };

    const handleModeChange = (newMode: 'video' | 'audio') => {
        setMode(newMode);
        setSelectedId(null);
        // Maybe auto-select the first one?
    };

    const formats = mode === 'video' ? availableFormats : audioFormats;

    return (
        <div className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-4 space-y-4">
            {/* Mode Switcher */}
            <div className="flex p-1 bg-zinc-900 rounded-lg">
                <button
                    onClick={() => handleModeChange('video')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'video'
                            ? 'bg-zinc-800 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                >
                    Video
                </button>
                <button
                    onClick={() => handleModeChange('audio')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'audio'
                            ? 'bg-zinc-800 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                >
                    Audio
                </button>
            </div>

            {/* Format List */}
            <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
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
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-all border ${selectedId === fmt.format_id
                                            ? 'bg-zinc-100 text-black border-transparent font-medium'
                                            : 'bg-zinc-900/50 text-zinc-300 border-transparent hover:bg-zinc-800 hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span>{fmt.resolution}</span>
                                        {fmt.extension && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${selectedId === fmt.format_id
                                                    ? 'bg-black/10 text-black/70'
                                                    : 'bg-zinc-800 text-zinc-500'
                                                }`}>
                                                {fmt.extension.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <span className={selectedId === fmt.format_id ? 'text-black/70' : 'text-zinc-500'}>
                                        {fmt.filesize_str}
                                    </span>
                                </button>
                            ))
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
