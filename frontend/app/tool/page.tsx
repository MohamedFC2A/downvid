'use client';
import { useEffect, useMemo, useRef, useState } from "react";
import { InsightsPanel } from "@/components/modules/ai/InsightsPanel";
import type { VideoFormat } from "@/components/QualitySelector";
import { analyzeVideo, type AnalyzeResult } from "@/lib/api";
import { WebSocketClient, DownloadStatus } from "@/lib/socket";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { BulkUrlInput } from "@/components/modules/downloader/BulkUrlInput";
import { DownloadCard, QueueItem } from "@/components/modules/downloader/DownloadCard";
import { DownloadPrefs } from "@/components/modules/downloader/FormatPicker";
import { AdminLogsPanel } from "@/components/modules/debug/AdminLogsPanel";

const PREFS_KEY = "downvid:prefs:v1";

function loadPrefs(): DownloadPrefs {
    if (typeof window === "undefined") return { mode: "video", container: "mp4", height: 1080 };
    try {
        const raw = window.localStorage.getItem(PREFS_KEY);
        if (!raw) return { mode: "video", container: "mp4", height: 1080 };
        const j = JSON.parse(raw);
        return {
            mode: j.mode === "audio" ? "audio" : "video",
            container: ["mp4", "webm", "mp3", "m4a"].includes(j.container) ? j.container : "mp4",
            height: typeof j.height === "number" ? j.height : 1080,
        };
    } catch {
        return { mode: "video", container: "mp4", height: 1080 };
    }
}

function savePrefs(p: DownloadPrefs) {
    try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch {
        // ignore
    }
}

function pickClosest(formats: VideoFormat[], prefs: DownloadPrefs): string | null {
    if (!formats || formats.length === 0) return null;
    const container = prefs.mode === "audio" && prefs.container === "mp3" ? "" : prefs.container;
    const candidates = container ? formats.filter((f) => f.extension === container) : formats;
    const list = candidates.length ? candidates : formats;

    const withHeight = list
        .map((f) => ({ f, h: f.height }))
        .filter((x) => typeof x.h === "number" && x.h > 0);

    if (prefs.mode === "video" && withHeight.length) {
        withHeight.sort((a, b) => {
            const da = Math.abs(prefs.height - (a.h || 0));
            const db = Math.abs(prefs.height - (b.h || 0));
            if (da !== db) return da - db;
            return (b.h || 0) - (a.h || 0);
        });
        return withHeight[0].f.format_id;
    }

    return list[0].format_id;
}

export default function ToolPage() {
    const [prefs, setPrefs] = useState<DownloadPrefs>(() => loadPrefs());
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showAdmin, setShowAdmin] = useState(false);
    const [bulkRun, setBulkRun] = useState(false);

    // per-item websocket clients
    const wsMapRef = useRef<Map<string, WebSocketClient>>(new Map());
    const queueRef = useRef<QueueItem[]>([]);
    const idSeqRef = useRef(0);
    const completionRef = useRef<Map<string, () => void>>(new Map());

    useEffect(() => {
        queueRef.current = queue;
    }, [queue]);

    const selected = useMemo(() => queue.find((q) => q.id === selectedId) || null, [queue, selectedId]);

    function startDownload(id: string) {
        const item = queueRef.current.find((q) => q.id === id);
        if (!item || item.isAnalyzing) return;

        // Close any existing socket for this item (restart scenario)
        const old = wsMapRef.current.get(id);
        old?.close();
        wsMapRef.current.delete(id);

        const clientId = `${id}-${Math.random().toString(36).slice(2)}`;
        const ws = new WebSocketClient(clientId, (data: DownloadStatus) => {
            setQueue((prev) =>
                prev.map((q) => {
                    if (q.id !== id) return q;
                    return {
                        ...q,
                        status: data.status || q.status,
                        percent: typeof data.percent === "number" ? data.percent : q.percent,
                        speed: data.speed || q.speed,
                        eta: data.eta || q.eta,
                        error: data.error || q.error,
                        isDownloading: data.status !== "completed" && data.status !== "error",
                    };
                })
            );

            if (data.status === "completed" && data.file_token) {
                const downloadUrl = `/api/file/serve/${data.file_token}`;
                const link = document.createElement("a");
                link.href = downloadUrl;
                link.setAttribute("download", data.filename || "download");
                document.body.appendChild(link);
                link.click();
                link.remove();
            }

            if (data.status === "completed" || data.status === "error") {
                const done = completionRef.current.get(id);
                if (done) {
                    completionRef.current.delete(id);
                    done();
                }
            }
        });

        wsMapRef.current.set(id, ws);
        ws.connect();

        const chosenId =
            item.prefs.mode === "video" ? pickClosest(item.availableFormats, item.prefs) : pickClosest(item.audioFormats, item.prefs);

        setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, status: "initializing", percent: 0, isDownloading: true } : q)));

        ws.sendDownloadSpec(item.url, {
            mode: item.prefs.mode,
            container: item.prefs.container,
            height: item.prefs.mode === "video" ? item.prefs.height : undefined,
            format_id: chosenId || undefined,
        });
    }

    function waitForCompletion(id: string): Promise<void> {
        const current = queueRef.current.find((q) => q.id === id);
        if (!current) return Promise.resolve();
        if (current.status === "completed" || current.status === "error") return Promise.resolve();
        return new Promise((resolve) => {
            completionRef.current.set(id, resolve);
        });
    }

    async function downloadAll() {
        setBulkRun(true);
        try {
            for (const item of queueRef.current) {
                if (item.isAnalyzing) continue;
                if (item.status === "completed") continue;
                startDownload(item.id);
                await waitForCompletion(item.id);
            }
        } finally {
            setBulkRun(false);
        }
    }

    const addUrls = async (urls: string[]) => {
        const nextItems: QueueItem[] = urls.map((url, idx) => ({
            id: `q${idSeqRef.current + 1 + idx}`,
            url,
            title: "",
            thumbnail: "",
            availableFormats: [],
            audioFormats: [],
            prefs,
            status: "idle",
            percent: 0,
            isAnalyzing: true,
            isDownloading: false,
        }));
        idSeqRef.current += nextItems.length;

        setQueue((prev) => [...nextItems, ...prev]);
        if (!selectedId && nextItems.length) setSelectedId(nextItems[0].id);

        // analyze sequentially to avoid rate-limits
        for (const it of nextItems) {
            await analyzeItem(it.id, it.url);
        }
    };

    const analyzeItem = async (id: string, urlOverride?: string) => {
        setQueue((prev) =>
            prev.map((q) => (q.id === id ? { ...q, isAnalyzing: true, status: "idle", percent: 0, error: undefined } : q))
        );
        const url = urlOverride || queueRef.current.find((q) => q.id === id)?.url;
        if (!url) return;

        try {
            const data: AnalyzeResult = await analyzeVideo(url);
            const available = (data.available_formats || []) as VideoFormat[];
            const audio = (data.audio_formats || []) as VideoFormat[];

            setQueue((prev) =>
                prev.map((q) =>
                    q.id === id
                        ? {
                            ...q,
                            title: data.title,
                            thumbnail: data.thumbnail,
                            description: data.description,
                            analysisData: data.analysis,
                            availableFormats: available,
                            audioFormats: audio,
                            isAnalyzing: false,
                        }
                        : q
                )
            );
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Analysis failed";
            setQueue((prev) =>
                prev.map((q) =>
                    q.id === id
                        ? { ...q, isAnalyzing: false, status: "error", percent: 0, error: msg }
                        : q
                )
            );
        }
    };

    const updateItemPrefs = (id: string, next: DownloadPrefs) => {
        setPrefs(next);
        savePrefs(next);
        setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, prefs: next } : q)));
    };

    const removeItem = (id: string) => {
        const ws = wsMapRef.current.get(id);
        ws?.close();
        wsMapRef.current.delete(id);
        setQueue((prev) => prev.filter((q) => q.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    const clearQueue = () => {
        for (const ws of wsMapRef.current.values()) {
            try {
                ws.close();
            } catch {
                // ignore
            }
        }
        wsMapRef.current.clear();
        setQueue([]);
        setSelectedId(null);
        setBulkRun(false);
    };

    return (
        <main className="min-h-screen pt-32 pb-12 px-4 flex flex-col items-center relative z-10">
            <div className="w-full max-w-6xl space-y-12">
                <div className="text-center space-y-4 flex flex-col items-center">
                    <div className="mb-4">
                        <Logo />
                    </div>
                    <p className="text-zinc-500 text-lg tracking-wide uppercase font-mono">
                        Professional extraction pipeline
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                        variant="secondary"
                        className="h-11 px-5 text-sm"
                        onClick={() => setShowAdmin((v) => !v)}
                    >
                        {showAdmin ? "Hide" : "Show"} Debug
                    </Button>
                    <Button
                        className="h-11 px-6 text-sm font-semibold"
                        onClick={downloadAll}
                        disabled={queue.length === 0 || queue.some((q) => q.isAnalyzing)}
                    >
                        {bulkRun ? "Running..." : "Download All"}
                    </Button>
                    <Button variant="secondary" className="h-11 px-6 text-sm" onClick={clearQueue} disabled={queue.length === 0}>
                        Clear Queue
                    </Button>
                </div>

                <BulkUrlInput onAddUrls={addUrls} />

                {queue.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start fade-in-up">
                        <div className="lg:col-span-7 space-y-4">
                            {queue.map((item) => (
                                <div key={item.id} onClick={() => setSelectedId(item.id)} className="cursor-pointer">
                                    <DownloadCard
                                        item={item}
                                        onChangePrefs={updateItemPrefs}
                                        onAnalyze={analyzeItem}
                                        onStart={startDownload}
                                        onRemove={removeItem}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="lg:col-span-5 space-y-6">
                            <AdminLogsPanel enabled={showAdmin} />
                            <InsightsPanel data={selected?.analysisData || null} isLoading={false} />
                            {!selected && (
                                <div className="text-zinc-600 text-sm font-mono text-center border border-zinc-800 rounded-xl p-6 bg-zinc-950/30">
                                    Select an item to see details
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

// Simple generic animation class injection if needed, or rely on global CSS
