'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { TerminalBlock } from "@/components/ui/TerminalBlock";
import { Button } from "@/components/ui/Button";

type AdminLogItem = {
    ts: string;
    event: string;
    data: Record<string, unknown>;
};

function safeJson(v: unknown) {
    try {
        return JSON.stringify(v, null, 2);
    } catch {
        return String(v);
    }
}

export function AdminLogsPanel({ enabled }: { enabled: boolean }) {
    const [items, setItems] = useState<AdminLogItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const visible = useMemo(() => items.slice(0, 60), [items]);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
            const res = await fetch(`${baseUrl}/api/admin/logs?limit=120`, { cache: "no-store" });
            if (!res.ok) {
                const j = await res.json().catch(() => null);
                throw new Error(j?.detail || `Failed to load logs (${res.status})`);
            }
            const j = await res.json();
            setItems(j.items || []);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to load logs";
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;
        refresh();
        const t = window.setInterval(refresh, 2000);
        return () => window.clearInterval(t);
    }, [enabled, refresh]);

    if (!enabled) return null;

    return (
        <TerminalBlock title="ADMIN DEBUG" className="min-h-[320px]">
            <div className="flex items-center justify-between gap-3 mb-3">
                <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                    {isLoading ? "Refreshing..." : "Live (2s)"} {error ? `• ${error}` : ""}
                </div>
                <Button variant="secondary" className="h-8 px-3 text-xs" onClick={refresh}>
                    Refresh
                </Button>
            </div>

            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {visible.length === 0 ? (
                    <div className="text-zinc-600 text-xs font-mono">No logs yet</div>
                ) : (
                    visible.map((it, idx) => (
                        <details key={`${it.ts}-${idx}`} className="rounded border border-zinc-800/60 bg-zinc-950/40">
                            <summary className="cursor-pointer select-none px-3 py-2 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-green-500 font-mono text-[10px]">{it.event}</span>
                                    <span className="text-zinc-600 font-mono text-[10px]">{new Date(it.ts).toLocaleTimeString()}</span>
                                </div>
                                <span className="text-zinc-600 font-mono text-[10px]">details</span>
                            </summary>
                            <pre className="px-3 pb-3 text-[11px] text-zinc-300 whitespace-pre-wrap break-words">
                                {safeJson(it.data)}
                            </pre>
                        </details>
                    ))
                )}
            </div>
        </TerminalBlock>
    );
}
