'use client';

import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/modules/downloader/ProgressBar";
import { FormatPicker, DownloadPrefs } from "@/components/modules/downloader/FormatPicker";
import type { VideoFormat } from "@/components/QualitySelector";

export type InsightsData = {
    summary: string[];
    sentiment: string;
    hashtags: string[];
};

export type QueueItem = {
    id: string;
    url: string;
    title?: string;
    thumbnail?: string;
    description?: string;
    analysisData?: InsightsData | null;
    availableFormats: VideoFormat[];
    audioFormats: VideoFormat[];
    prefs: DownloadPrefs;
    status: string;
    percent: number;
    speed?: string;
    eta?: string;
    error?: string;
    isAnalyzing?: boolean;
    isDownloading?: boolean;
};

export function DownloadCard({
    item,
    onChangePrefs,
    onAnalyze,
    onStart,
    onRemove,
}: {
    item: QueueItem;
    onChangePrefs: (id: string, prefs: DownloadPrefs) => void;
    onAnalyze: (id: string) => void;
    onStart: (id: string) => void;
    onRemove: (id: string) => void;
}) {
    const isDone = item.status === "completed";
    const isError = item.status === "error";

    return (
        <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <Card className={`w-full ${isError ? "border-red-500/30" : isDone ? "border-green-500/30" : ""}`} spotlight>
                <div className="p-4 sm:p-5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="w-24 h-14 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 flex-shrink-0">
                                {item.thumbnail ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={item.thumbnail} alt={item.title || "thumbnail"} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-600 font-mono">PREVIEW</div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-semibold tracking-tight truncate">{item.title || "Video"}</div>
                                <div className="text-[11px] text-zinc-500 font-mono break-all line-clamp-2">{item.url}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                            <Button variant="secondary" className="h-9 px-3 text-xs" onClick={() => onAnalyze(item.id)} disabled={item.isAnalyzing}>
                                {item.isAnalyzing ? "Analyzing..." : "Re-analyze"}
                            </Button>
                            <Button variant="secondary" className="h-9 px-3 text-xs" onClick={() => onRemove(item.id)}>
                                Remove
                            </Button>
                        </div>
                    </div>

                    {isError && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                            {item.error || "Download failed"}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                        <div className="lg:col-span-7">
                            <FormatPicker
                                availableFormats={item.availableFormats}
                                audioFormats={item.audioFormats}
                                value={item.prefs}
                                onChange={(next) => onChangePrefs(item.id, next)}
                            />
                        </div>
                        <div className="lg:col-span-5 space-y-3">
                            <div className="flex gap-2">
                                <Button
                                    className="flex-1 h-11 text-sm font-semibold"
                                    onClick={() => onStart(item.id)}
                                    disabled={item.isDownloading || item.isAnalyzing}
                                >
                                    {item.isDownloading ? "Downloading..." : "Download"}
                                </Button>
                                <Button variant="secondary" className="h-11 px-4 text-sm" onClick={() => onRemove(item.id)} disabled={item.isDownloading}>
                                    X
                                </Button>
                            </div>

                            {item.isDownloading && (
                                <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4">
                                    <ProgressBar progress={item.percent} status={item.status} speed={item.speed} eta={item.eta} />
                                </div>
                            )}
                            {!item.isDownloading && item.status !== "idle" && item.status !== "error" && (
                                <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4">
                                    <ProgressBar progress={item.percent} status={item.status} speed={item.speed} eta={item.eta} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Card>
        </motion.div>
    );
}
