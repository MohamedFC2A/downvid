import { TerminalBlock } from "@/components/ui/TerminalBlock";
import { Badge } from "@/components/ui/Badge";

interface InsightsProps {
    data: {
        summary: string[];
        sentiment: string;
        hashtags: string[];
    } | null;
    isLoading?: boolean;
}

export function InsightsPanel({ data, isLoading }: InsightsProps) {
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
                            <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_12px_rgba(34,197,94,0.6)]" />
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
        <TerminalBlock title="DEEPSEEK INTELLIGENCE">
            <div className="space-y-6">
                <div>
                    <div className="text-zinc-600 mb-2 uppercase text-[10px] tracking-widest">Summary</div>
                    <div className="text-zinc-300 space-y-2 text-right" dir="rtl">
                        {data.summary.map((point, i) => (
                            <div key={i} className="flex gap-2 items-start justify-end">
                                <span>{point}</span>
                                <span className="text-green-500 mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
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
                    <div className="text-zinc-600 mb-2 uppercase text-[10px] tracking-widest">Hashtags</div>
                    <div className="flex flex-wrap gap-2">
                        {data.hashtags.map((tag, i) => (
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
