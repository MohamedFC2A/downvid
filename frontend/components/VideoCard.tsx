'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Download, Sparkles, Clock, Calendar, Play, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';

interface VideoMetadata {
    title: string;
    thumbnail: string;
    duration: string;
    uploadDate: string;
    platform: 'youtube' | 'tiktok' | 'instagram';
}

interface VideoCardProps {
    metadata: VideoMetadata;
    onDownload: (format: string, quality: string) => void;
    onGetInsights: () => void;
    isGettingInsights: boolean;
}

export default function VideoCard({
    metadata,
    onDownload,
    onGetInsights,
    isGettingInsights
}: VideoCardProps) {
    const [selectedFormat, setSelectedFormat] = useState('mp4');
    const [selectedQuality, setSelectedQuality] = useState('1080p');
    const [showQuality, setShowQuality] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
                duration: 0.7,
                type: 'spring',
                stiffness: 100,
                damping: 15
            }}
            className="w-full max-w-5xl mx-auto"
        >
            <div className="glass-strong rounded-3xl overflow-hidden card-hover glow-purple">
                {/* Thumbnail Section with Overlay */}
                <div className="relative h-72 md:h-96 overflow-hidden group">
                    <Image
                        src={metadata.thumbnail}
                        alt={metadata.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        priority
                    />

                    {/* Gradient Overlays */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050510] via-[#050510]/60 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#050510]/40 to-transparent" />

                    {/* Platform Badge */}
                    <div className="absolute top-6 right-6">
                        <motion.div
                            className="glass-strong px-5 py-2.5 rounded-full flex items-center gap-2 glow-hover"
                            whileHover={{ scale: 1.05 }}
                        >
                            <Play className="w-4 h-4 text-cyan-400" fill="currentColor" />
                            <span className="text-sm font-bold uppercase tracking-wider gradient-text">
                                {metadata.platform}
                            </span>
                        </motion.div>
                    </div>

                    {/* Duration Badge */}
                    <div className="absolute bottom-6 right-6">
                        <div className="glass-strong px-4 py-2 rounded-full flex items-center gap-2">
                            <Clock className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm font-semibold">{metadata.duration}</span>
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="p-8 md:p-10 space-y-6 relative">
                    {/* Title */}
                    <div className="space-y-3">
                        <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">
                            {metadata.title}
                        </h2>

                        {/* Upload Date */}
                        <div className="flex items-center gap-2 text-gray-400">
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm">{metadata.uploadDate}</span>
                        </div>
                    </div>

                    {/* Format Selection */}
                    <div className="space-y-4">
                        <label className="block text-sm font-bold uppercase tracking-wider text-gray-400">
                            Select Format
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            {['mp4', 'mp3'].map((format) => (
                                <motion.button
                                    key={format}
                                    onClick={() => {
                                        setSelectedFormat(format);
                                        setShowQuality(format === 'mp4');
                                    }}
                                    className={`relative overflow-hidden py-5 px-8 rounded-2xl font-bold text-lg transition-all ${selectedFormat === format
                                            ? 'btn-gradient text-white shadow-2xl'
                                            : 'glass text-gray-300 hover:bg-white/10'
                                        }`}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="relative z-10 uppercase tracking-wide">
                                        {format}
                                    </span>
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    {/* Quality Selection (for MP4) */}
                    <AnimatePresence>
                        {selectedFormat === 'mp4' && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-4 overflow-hidden"
                            >
                                <label className="block text-sm font-bold uppercase tracking-wider text-gray-400">
                                    Select Quality
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {['2160p', '1080p', '720p', '480p'].map((quality) => (
                                        <motion.button
                                            key={quality}
                                            onClick={() => setSelectedQuality(quality)}
                                            className={`py-4 px-4 rounded-xl font-bold transition-all ${selectedQuality === quality
                                                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-xl'
                                                    : 'glass text-gray-300 hover:bg-white/10'
                                                }`}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            {quality}
                                            {quality === '2160p' && (
                                                <span className="block text-xs opacity-70">4K</span>
                                            )}
                                            {quality === '1080p' && (
                                                <span className="block text-xs opacity-70">Full HD</span>
                                            )}
                                        </motion.button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Action Buttons */}
                    <div className="grid md:grid-cols-2 gap-4 pt-4">
                        {/* Download Button */}
                        <motion.button
                            onClick={() => onDownload(selectedFormat, selectedQuality)}
                            className="relative overflow-hidden py-6 px-8 rounded-2xl font-bold text-lg btn-gradient text-white shadow-2xl group"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3">
                                <Download className="w-6 h-6" />
                                Download {selectedFormat.toUpperCase()}
                            </span>
                        </motion.button>

                        {/* AI Insights Button */}
                        <motion.button
                            onClick={onGetInsights}
                            disabled={isGettingInsights}
                            className="relative overflow-hidden py-6 px-8 rounded-2xl font-bold text-lg glass-strong text-white hover:bg-white/15 transition-all group"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            {isGettingInsights ? (
                                <>
                                    <div className="shimmer absolute inset-0" />
                                    <span className="relative z-10 flex items-center justify-center gap-3">
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                        >
                                            <Sparkles className="w-6 h-6 text-purple-400" />
                                        </motion.div>
                                        Analyzing...
                                    </span>
                                </>
                            ) : (
                                <span className="relative z-10 flex items-center justify-center gap-3">
                                    <Sparkles className="w-6 h-6 text-purple-400 group-hover:rotate-12 transition-transform" />
                                    Smart AI Insights
                                </span>
                            )}
                        </motion.button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
