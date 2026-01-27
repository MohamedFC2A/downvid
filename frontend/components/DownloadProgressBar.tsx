'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, AlertCircle } from 'lucide-react';

interface DownloadProgress {
    percentage?: number;
    downloaded?: string;
    total?: string;
    speed?: string;
    eta?: string;
    status?: string;
    message?: string;
}

interface ProgressBarProps {
    progress: DownloadProgress | null;
    error: string | null;
    onCancel: () => void;
}

export default function DownloadProgressBar({ progress, error, onCancel }: ProgressBarProps) {
    if (!progress && !error) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
                className="fixed inset-x-0 bottom-8 z-50 flex justify-center px-4"
            >
                <div className="glass-strong rounded-2xl p-6 max-w-2xl w-full space-y-4 cursor-spotlight">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {error ? (
                                <>
                                    <AlertCircle className="w-6 h-6 text-red-400" />
                                    <h3 className="text-lg font-bold text-red-400">Download Failed</h3>
                                </>
                            ) : (
                                <>
                                    <Download className="w-6 h-6 text-cyan-400" />
                                    <h3 className="text-lg font-bold text-white">Downloading...</h3>
                                </>
                            )}
                        </div>

                        <button
                            onClick={onCancel}
                            className="glass-strong p-2 rounded-xl hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-400 hover:text-white" />
                        </button>
                    </div>

                    {error ? (
                        /* Error Message */
                        <div className="p-4 glass rounded-xl border border-red-500/30">
                            <p className="text-red-300">{error}</p>
                        </div>
                    ) : (
                        <>
                            {/* Progress Bar */}
                            <div className="relative h-4 bg-black/30 rounded-full overflow-hidden">
                                <motion.div
                                    className="absolute inset-y-0 left-0 btn-gradient"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress?.percentage || 0}%` }}
                                    transition={{ duration: 0.3, ease: 'easeOut' }}
                                />

                                {/* Shimmer effect */}
                                {progress?.status === 'downloading' && (
                                    <div className="absolute inset-0 shimmer" />
                                )}

                                {/* Percentage text */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xs font-bold text-white drop-shadow-lg relative z-10">
                                        {progress?.percentage?.toFixed(1)}%
                                    </span>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div className="glass p-3 rounded-xl">
                                    <p className="text-gray-400 text-xs mb-1">Downloaded</p>
                                    <p className="font-semibold text-cyan-400">{progress?.downloaded || '0 B'}</p>
                                </div>

                                <div className="glass p-3 rounded-xl">
                                    <p className="text-gray-400 text-xs mb-1">Total</p>
                                    <p className="font-semibold text-white">{progress?.total || 'Unknown'}</p>
                                </div>

                                <div className="glass p-3 rounded-xl">
                                    <p className="text-gray-400 text-xs mb-1">Speed</p>
                                    <p className="font-semibold text-purple-400">{progress?.speed || 'Calculating...'}</p>
                                </div>

                                <div className="glass p-3 rounded-xl">
                                    <p className="text-gray-400 text-xs mb-1">ETA</p>
                                    <p className="font-semibold text-pink-400">{progress?.eta || 'Calculating...'}</p>
                                </div>
                            </div>

                            {/* Status Message */}
                            {progress?.message && (
                                <div className="text-center">
                                    <p className="text-sm text-gray-400 italic">{progress.message}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
