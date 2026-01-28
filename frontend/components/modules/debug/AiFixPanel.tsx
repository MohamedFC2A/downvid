'use client';

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api` : "/api";

type DiagnoseResult = {
    root_cause?: string;
    confidence?: number;
    quick_fixes?: string[];
    deep_fixes?: string[];
    need_cookies?: boolean;
    need_update?: boolean;
    notes?: string;
};

export function AiFixPanel({
    stage,
    url,
    error,
}: {
    stage: "analyze" | "download" | "ws" | "other";
    url: string;
    error: string;
}) {
    const [result, setResult] = useState<DiagnoseResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [reqError, setReqError] = useState<string | null>(null);

    async function run() {
        setIsLoading(true);
        setReqError(null);
        setResult(null);
        try {
            let res = await fetch(`${API_BASE}/ai/diagnose`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    stage,
                    url,
                    error,
                    context: {
                        ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
                    },
                }),
            });
            if (res.status === 405) {
                const qs = new URLSearchParams({
                    stage,
                    url,
                    error,
                });
                res = await fetch(`${API_BASE}/ai/diagnose?${qs.toString()}`, { method: "GET" });
            }

            const json = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(json?.detail || `AI diagnose failed (${res.status})`);
            }
            setResult(json);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "AI diagnose failed";
            setReqError(msg);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Card className="glass-panel rounded-2xl" spotlight={false}>
            <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="text-sm font-semibold tracking-tight">AI Error Fixer (DeepSeek)</div>
                        <div className="text-[11px] text-zinc-500 font-mono">
                            Stage: {stage} • {result?.need_update ? "Needs update" : "—"} • {result?.need_cookies ? "Cookies suggested" : "—"}
                        </div>
                    </div>
                    <Button className="h-9 px-4 text-xs" onClick={run} disabled={isLoading}>
                        {isLoading ? "Thinking..." : "Fix This"}
                    </Button>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-black/30 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono mb-2">Error</div>
                    <pre className="text-[11px] text-zinc-200 whitespace-pre-wrap break-words">{error}</pre>
                </div>

                {reqError && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                        {reqError}
                    </div>
                )}

                {result && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-zinc-800 bg-black/30 p-3">
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono mb-1">Root Cause</div>
                            <div className="text-sm text-zinc-100">{result.root_cause || "—"}</div>
                            <div className="text-[11px] text-zinc-500 font-mono mt-1">
                                Confidence: {typeof result.confidence === "number" ? result.confidence.toFixed(2) : "—"}
                            </div>
                        </div>

                        {Array.isArray(result.quick_fixes) && result.quick_fixes.length > 0 && (
                            <div className="rounded-xl border border-zinc-800 bg-black/30 p-3">
                                <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono mb-2">Quick Fixes</div>
                                <ul className="space-y-1 text-sm text-zinc-100 list-disc pl-5">
                                    {result.quick_fixes.slice(0, 10).map((x, i) => (
                                        <li key={i}>{x}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {Array.isArray(result.deep_fixes) && result.deep_fixes.length > 0 && (
                            <div className="rounded-xl border border-zinc-800 bg-black/30 p-3">
                                <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono mb-2">Deep Fixes</div>
                                <ul className="space-y-1 text-sm text-zinc-100 list-disc pl-5">
                                    {result.deep_fixes.slice(0, 10).map((x, i) => (
                                        <li key={i}>{x}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {result.notes && (
                            <div className="text-[11px] text-zinc-500 font-mono">{result.notes}</div>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
}
