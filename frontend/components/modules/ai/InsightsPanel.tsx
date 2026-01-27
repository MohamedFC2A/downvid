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
            <TerminalBlock title="DEEPSEEK V3 ANALYSIS" className="h-[300px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="animate-pulse text-green-500 font-mono tracking-wider">&gt;&gt; ANALYZING METADATA...</div>
                    <div className="text-zinc-600 text-xs">CONNECTING TO NEURAL NET</div>
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
