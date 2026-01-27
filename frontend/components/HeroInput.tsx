'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Youtube, Instagram, Download } from 'lucide-react';

interface HeroInputProps {
    onAnalyze: (url: string) => void;
    isLoading: boolean;
}

export default function HeroInput({ onAnalyze, isLoading }: HeroInputProps) {
    const [url, setUrl] = useState('');
    const [platform, setPlatform] = useState<'youtube' | 'tiktok' | 'instagram' | null>(null);
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!url) {
            setPlatform(null);
            return;
        }

        if (/youtube\.com|youtu\.be/i.test(url)) {
            setPlatform('youtube');
        } else if (/tiktok\.com/i.test(url)) {
            setPlatform('tiktok');
        } else if (/instagram\.com/i.test(url)) {
            setPlatform('instagram');
        } else {
            setPlatform(null);
        }
    }, [url]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (url && platform) {
            onAnalyze(url);
        }
    };

    const getPlatformIcon = () => {
        switch (platform) {
            case 'youtube':
                return <Youtube className="w-7 h-7 text-red-500" strokeWidth={2.5} />;
            case 'tiktok':
                return (
                    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                    </svg>
                );
            case 'instagram':
                return <Instagram className="w-7 h-7 text-pink-500" strokeWidth={2.5} />;
            default:
                return <Download className="w-7 h-7 text-gray-400" strokeWidth={2.5} />;
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto space-y-8">
            {/* Hero Title */}
            <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="text-center space-y-6"
            >
                <div className="inline-flex items-center gap-3 glass px-6 py-3 rounded-full mb-6">
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                    <span className="text-sm font-semibold text-cyan-400 uppercase tracking-wider">
                        AI-Powered Video Downloader
                    </span>
                </div>

                <h1 className="text-7xl md:text-8xl font-black mb-6 gradient-text text-glow leading-none">
                    GlassLoad AI
                </h1>

                <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                    Download videos from <span className="text-red-400 font-semibold">YouTube</span>,{' '}
                    <span className="font-semibold gradient-text-alt">TikTok</span> &{' '}
                    <span className="text-pink-400 font-semibold">Instagram</span> with smart AI insights
                </p>
            </motion.div>

            {/* Input Container */}
            <motion.form
                onSubmit={handleSubmit}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
            >
                <div
                    className={`glass-strong rounded-3xl p-3 transition-all duration-500 ${isFocused ? 'glow-cyan scale-[1.02]' : ''
                        } ${platform ? 'neon-border' : ''}`}
                >
                    <div className="flex items-center gap-4">
                        {/* Platform Icon */}
                        <div className="pl-4">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={platform || 'default'}
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    exit={{ scale: 0, rotate: 180 }}
                                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                                    className={`${platform ? 'pulse-glow' : ''}`}
                                >
                                    {getPlatformIcon()}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Input Field */}
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            placeholder="Paste your video URL here..."
                            className="flex-1 bg-transparent text-white text-xl placeholder-gray-500 focus:outline-none py-5 font-medium"
                            disabled={isLoading}
                        />

                        {/* Submit Button */}
                        <motion.button
                            type="submit"
                            disabled={!platform || isLoading}
                            className={`px-10 py-5 rounded-2xl font-bold text-lg text-white transition-all duration-300 relative overflow-hidden ${platform && !isLoading
                                    ? 'btn-gradient shadow-2xl glow-hover'
                                    : 'bg-gray-800/50 cursor-not-allowed opacity-60'
                                }`}
                            whileHover={platform && !isLoading ? { scale: 1.05 } : {}}
                            whileTap={platform && !isLoading ? { scale: 0.95 } : {}}
                        >
                            {isLoading ? (
                                <div className="flex items-center gap-3">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    >
                                        <Sparkles className="w-6 h-6" />
                                    </motion.div>
                                    <span>Analyzing...</span>
                                </div>
                            ) : (
                                'Analyze Video'
                            )}
                        </motion.button>
                    </div>
                </div>
            </motion.form>

            {/* Platform Badges */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex justify-center items-center gap-4 flex-wrap"
            >
                <span className="text-sm text-gray-400">Supported Platforms:</span>
                <div className="flex gap-3">
                    {[
                        { icon: <Youtube className="w-5 h-5" />, name: 'YouTube', color: 'text-red-400' },
                        { icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" /></svg>, name: 'TikTok', color: 'text-white' },
                        { icon: <Instagram className="w-5 h-5" />, name: 'Instagram', color: 'text-pink-400' },
                    ].map((platform, idx) => (
                        <motion.div
                            key={platform.name}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.5 + idx * 0.1 }}
                            className="glass px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-white/10 transition-colors cursor-pointer card-hover"
                        >
                            <span className={platform.color}>{platform.icon}</span>
                            <span className="text-sm font-medium text-gray-300">{platform.name}</span>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}
