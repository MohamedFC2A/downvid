'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Hash, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';

interface InsightsData {
    summary: string;
    hashtags: string[];
}

interface SmartInsightsProps {
    isOpen: boolean;
    onClose: () => void;
    insights: InsightsData | null;
    isLoading: boolean;
}

export default function SmartInsights({
    isOpen,
    onClose,
    insights,
    isLoading
}: SmartInsightsProps) {
    const [displayedText, setDisplayedText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    // Typing effect for AI response
    useEffect(() => {
        if (!insights?.summary || !isOpen) {
            setDisplayedText('');
            setCurrentIndex(0);
            return;
        }

        if (currentIndex < insights.summary.length) {
            const timeout = setTimeout(() => {
                setDisplayedText(insights.summary.substring(0, currentIndex + 1));
                setCurrentIndex(currentIndex + 1);
            }, 30);

            return () => clearTimeout(timeout);
        }
    }, [currentIndex, insights, isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-2xl max-h-[85vh] overflow-auto z-50"
                    >
                        <div className="glass-strong rounded-3xl p-6 md:p-8 relative">
                            {/* Close Button */}
                            <motion.button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 glass rounded-full hover:bg-white/20 transition-colors"
                                whileHover={{ scale: 1.1, rotate: 90 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                <X className="w-5 h-5" />
                            </motion.button>

                            {/* Header */}
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 glass rounded-2xl">
                                    <Sparkles className="w-6 h-6 text-violet-400" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white">
                                        Smart AI Insights
                                    </h3>
                                    <p className="text-sm text-gray-400">
                                        Powered by DeepSeek V3
                                    </p>
                                </div>
                            </div>

                            {/* Loading State */}
                            {isLoading && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="py-12 text-center"
                                >
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                        className="inline-block mb-4"
                                    >
                                        <Sparkles className="w-12 h-12 text-violet-400" />
                                    </motion.div>
                                    <p className="text-gray-300 shimmer">
                                        Analyzing video content...
                                    </p>
                                </motion.div>
                            )}

                            {/* Insights Content */}
                            {!isLoading && insights && (
                                <div className="space-y-6">
                                    {/* Summary Section */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <FileText className="w-5 h-5 text-cyan-400" />
                                            <h4 className="text-lg font-semibold text-white">
                                                Summary
                                            </h4>
                                        </div>
                                        <div className="glass p-4 rounded-2xl">
                                            <p className="text-gray-200 leading-relaxed text-right" dir="rtl">
                                                {displayedText}
                                                {currentIndex < insights.summary.length && (
                                                    <motion.span
                                                        animate={{ opacity: [1, 0] }}
                                                        transition={{ duration: 0.5, repeat: Infinity }}
                                                        className="inline-block w-0.5 h-5 bg-violet-400 ml-1"
                                                    />
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Hashtags Section */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Hash className="w-5 h-5 text-violet-400" />
                                            <h4 className="text-lg font-semibold text-white">
                                                Viral Hashtags
                                            </h4>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {insights.hashtags.map((hashtag, index) => (
                                                <motion.div
                                                    key={hashtag}
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: index * 0.1 }}
                                                    className="glass px-4 py-2 rounded-full text-sm font-medium text-violet-300 hover:bg-white/15 cursor-pointer transition-colors"
                                                    whileHover={{ scale: 1.05 }}
                                                >
                                                    #{hashtag}
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Copy Button */}
                                    <motion.button
                                        onClick={() => {
                                            const text = `${insights.summary}\n\n${insights.hashtags.map(h => `#${h}`).join(' ')}`;
                                            navigator.clipboard.writeText(text);
                                        }}
                                        className="w-full py-3 px-6 glass-strong rounded-xl font-semibold hover:bg-white/15 transition-colors"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        Copy to Clipboard
                                    </motion.button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
