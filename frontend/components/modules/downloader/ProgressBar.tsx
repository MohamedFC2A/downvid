'use client';
import { motion } from "framer-motion";

interface ProgressBarProps {
    progress: number; // 0 to 100
    status: string;
    speed?: string;
}

export function ProgressBar({ progress, status, speed }: ProgressBarProps) {
    return (
        <div className="w-full space-y-2 font-mono text-xs">
            <div className="flex justify-between text-zinc-400 items-end">
                <span className="uppercase tracking-wider">{status}</span>
                <span className="text-zinc-500">{speed}</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                <motion.div
                    className="h-full bg-white relative"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                >
                    {/* Glow effect at the tip */}
                    <div className="absolute right-0 top-0 bottom-0 w-2 bg-white shadow-[0_0_10px_2px_rgba(255,255,255,0.8)]" />
                </motion.div>
            </div>
            <div className="text-right text-zinc-500 pt-1">{progress.toFixed(1)}%</div>
        </div>
    );
}
