import { useMemo, useState } from "react";
import { TerminalBlock } from "@/components/ui/TerminalBlock";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { summarizeVideo, type SummarizeResult } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { AppLanguage } from "@/lib/settings";

interface InsightsProps {
    data: {
        summary: string[];
        sentiment: string;
        hashtags: string[];
        topics?: string[];
        keywords?: string[];
        hook?: string;
    } | null;
    isLoading?: boolean;
    url?: string;
    language: AppLanguage;
    aiEnabled: boolean;
}

export function InsightsPanel({ data, isLoading, url, language, aiEnabled }: InsightsProps) {
    const [summary, setSummary] = useState<SummarizeResult | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summarizeError, setSummarizeError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const hashtagsText = useMemo(() => {
        const list = (summary?.hashtags && summary.hashtags.length > 0)
            ? summary.hashtags
            : (data?.hashtags || []);
        return list.join(" ");
    }, [data?.hashtags, summary?.hashtags]);

    async function onSummarize() {
        if (!url || !aiEnabled) return;
        setIsSummarizing(true);
        setSummarizeError(null);
        try {
            const res = await summarizeVideo(url, { ai: true, lang: language });
            setSummary(res);
        } catch (e: unknown) {
            setSummarizeError(e instanceof Error ? e.message : "Summarize failed");
        } finally {
            setIsSummarizing(false);
        }
    }

    async function onCopyHashtags() {
        try {
            await navigator.clipboard.writeText(hashtagsText);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 900);
        } catch {
            // ignore
        }
    }

    if (isLoading) {
        return (
            <TerminalBlock title="NEURAL ANALYSIS" className="h-[300px]">
                <div className="flex h-full flex-col justify-between rounded-xl border border-[var(--panel-border)] bg-[var(--deep)] p-4">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-zinc-500">
                        <span>DeepSeek V3</span>
                        <span className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-[10px] text-green-400">
                            Live
                        </span>
                    </div>

                    <div className="space-y-3 text-left">
                        <div className="flex items-center gap-2 text-green-400 font-mono text-sm">
                            <span className="h-2 w-2 rounded-full bg-green-400" />
                            <span className="tracking-widest">ANALYZING METADATA</span>
                            <span className="animate-pulse">...</span>
                        </div>
                        <div className="text-xs text-zinc-500">
                            CONNECTING TO NEURAL NET
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="h-1.5 w-full rounded-full bg-[var(--panel)]">
                            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-green-400/30 via-green-400/60 to-green-400/30 animate-pulse" />
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                            <span>Signal handshake</span>
                            <span>Stream warm-up</span>
                        </div>
                    </div>
                </div>
            </TerminalBlock>
        );
    }

    if (!data) return null;

    return (
        <TerminalBlock title={t(language, "ai.title")}>
            <div className="space-y-6">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        {data.hook && (
                            <div className="text-sm text-zinc-100 font-semibold">
                                {data.hook}
                            </div>
                        )}
                        <div className="text-[11px] text-zinc-500 font-mono">
                            {summary?.source
                                ? `${t(language, summary.source === "transcript" ? "ai.sourceTranscript" : "ai.sourceMetadata")}${summary.has_transcript ? "" : ""}`
                                : ""}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            className="h-8 px-3 text-[11px]"
                            onClick={onCopyHashtags}
                            disabled={!hashtagsText}
                        >
                            {copied ? t(language, "ai.copied") : t(language, "ai.copyHashtags")}
                        </Button>
                        <Button
                            className="h-8 px-3 text-[11px]"
                            onClick={onSummarize}
                            disabled={!url || !aiEnabled || isSummarizing}
                        >
                            {isSummarizing ? t(language, "ai.summarizing") : t(language, "ai.summarize")}
                        </Button>
                    </div>
                </div>

                {summarizeError && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                        {summarizeError}
                    </div>
                )}

                {summary?.summary && summary.summary.length > 0 && (
                    <div>
                        <div className="text-zinc-600 mb-2 uppercase text-[10px] tracking-widest">{t(language, "ai.summary")}</div>
                        <div className="text-zinc-300 space-y-2" dir={language === "ar" ? "rtl" : "ltr"}>
                            {summary.summary.slice(0, 12).map((point, i) => (
                                <div key={i} className="flex gap-2 items-start">
                                    <span className="text-green-500 mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                    <span>{point}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {summary?.key_moments && summary.key_moments.length > 0 && (
                    <div className="border-t border-[var(--panel-border)] pt-4">
                        <div className="text-zinc-600 mb-2 uppercase text-[10px] tracking-widest">{t(language, "ai.keyMoments")}</div>
                        <div className="text-zinc-300 space-y-2" dir={language === "ar" ? "rtl" : "ltr"}>
                            {summary.key_moments.slice(0, 10).map((point, i) => (
                                <div key={i} className="flex gap-2 items-start">
                                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" />
                                    <span>{point}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {summary?.takeaways && summary.takeaways.length > 0 && (
                    <div className="border-t border-[var(--panel-border)] pt-4">
                        <div className="text-zinc-600 mb-2 uppercase text-[10px] tracking-widest">{t(language, "ai.takeaways")}</div>
                        <div className="text-zinc-300 space-y-2" dir={language === "ar" ? "rtl" : "ltr"}>
                            {summary.takeaways.slice(0, 8).map((point, i) => (
                                <div key={i} className="flex gap-2 items-start">
                                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--ember)] flex-shrink-0" />
                                    <span>{point}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <div className="text-zinc-600 mb-2 uppercase text-[10px] tracking-widest">{t(language, "ai.summary")}</div>
                    <div className="text-zinc-300 space-y-2" dir={language === "ar" ? "rtl" : "ltr"}>
                        {data.summary.map((point, i) => (
                            <div key={i} className="flex gap-2 items-start">
                                <span className="text-green-500 mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                <span>{point}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-zinc-800/50 pt-4">
                    <div>
                        <div className="text-zinc-600 mb-1 uppercase text-[10px] tracking-widest">Sentiment</div>
                        <div className="text-white font-bold tracking-tight">{data.sentiment}</div>
                    </div>
                    <div>
                        <div className="text-zinc-600 mb-1 uppercase text-[10px] tracking-widest">Model</div>
                        <div className="text-zinc-400 text-xs text-right">DeepSeek V3</div>
                    </div>
                </div>

                <div className="border-t border-zinc-800/50 pt-4">
                    <div className="text-zinc-600 mb-2 uppercase text-[10px] tracking-widest">{t(language, "ai.hashtags")}</div>
                    <div className="flex flex-wrap gap-2">
                        {(summary?.hashtags && summary.hashtags.length > 0 ? summary.hashtags : data.hashtags).map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] font-mono hover:border-green-500/50 transition-colors">
                                {tag.startsWith('#') ? tag : `#${tag}`}
                            </Badge>
                        ))}
                    </div>
                </div>
            </div>
        </TerminalBlock>
    );
}
