'use client';

import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function extractUrls(text: string): string[] {
    const raw = (text || "")
        .split(/\s+/g)
        .map((s) => s.trim())
        .filter(Boolean);

    const urls: string[] = [];
    for (const token of raw) {
        if (token.startsWith("http://") || token.startsWith("https://")) {
            urls.push(token);
        }
    }
    // dedupe preserve order
    return Array.from(new Set(urls));
}

export function BulkUrlInput({ onAddUrls }: { onAddUrls: (urls: string[]) => void }) {
    const [value, setValue] = useState("");
    const parsed = useMemo(() => extractUrls(value), [value]);

    const submit = () => {
        if (parsed.length === 0) return;
        onAddUrls(parsed);
        setValue("");
    };

    return (
        <Card className="w-full" spotlight>
            <div className="p-4 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <div className="text-sm font-semibold tracking-tight">Paste or drop URLs</div>
                        <div className="text-xs text-zinc-500 font-mono">
                            One per line • Bulk supported • Drop text from the browser
                        </div>
                    </div>
                    <Button onClick={submit} disabled={parsed.length === 0} className="h-10 px-4 text-sm">
                        Add {parsed.length > 0 ? `(${parsed.length})` : ""}
                    </Button>
                </div>

                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        const text = e.dataTransfer.getData("text");
                        if (text) setValue((prev) => (prev ? `${prev}\n${text}` : text));
                    }}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/30 focus-within:border-zinc-600 transition-colors"
                >
                    <textarea
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=...\nhttps://www.tiktok.com/@...\n..."
                        className="w-full min-h-[140px] bg-transparent outline-none p-4 font-mono text-sm text-zinc-200 placeholder:text-zinc-700 resize-none"
                    />
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-600 font-mono">
                    <span>{parsed.length} valid URL(s) detected</span>
                    <button
                        type="button"
                        className="text-zinc-500 hover:text-zinc-300 transition-colors"
                        onClick={() => setValue("")}
                    >
                        Clear
                    </button>
                </div>
            </div>
        </Card>
    );
}

