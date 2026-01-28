'use client';
import { useEffect, useMemo, useRef, useState } from "react";
import { InsightsPanel } from "@/components/modules/ai/InsightsPanel";
import { QualitySelector, type VideoFormat } from "@/components/QualitySelector";
import { analyzeVideo, type AnalyzeResult } from "@/lib/api";
import { WebSocketClient, type DownloadStatus } from "@/lib/socket";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { AdminLogsPanel } from "@/components/modules/debug/AdminLogsPanel";
import { AiFixPanel } from "@/components/modules/debug/AiFixPanel";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

const LAST_SELECTION_KEY = "downvid:lastSelection:v1";

export default function ToolPage() {
    const [showAdmin, setShowAdmin] = useState(false);
    const [url, setUrl] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisData, setAnalysisData] = useState<AnalyzeResult["analysis"] | null>(null);
    const [videoInfo, setVideoInfo] = useState<{ title: string; thumbnail?: string; description?: string } | null>(null);
    const [availableFormats, setAvailableFormats] = useState<VideoFormat[]>([]);
    const [audioFormats, setAudioFormats] = useState<VideoFormat[]>([]);
    const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);
    const [downloadMode, setDownloadMode] = useState<"video" | "audio">("video");
    const [status, setStatus] = useState<DownloadStatus>({ status: "idle", percent: 0 });

    const [lastErrorStage, setLastErrorStage] = useState<"analyze" | "download" | "ws" | "other">("other");
    const [lastError, setLastError] = useState<string>("");

    const clientId = useMemo(() => Math.random().toString(36).slice(2), []);
    const wsRef = useRef<WebSocketClient | null>(null);

    useEffect(() => {
        wsRef.current = new WebSocketClient(clientId, (data) => {
            setStatus((prev) => ({ ...prev, ...data }));
            if (data.status === "error" && data.error) {
                setLastErrorStage("download");
                setLastError(data.error);
            }
            if (data.status === "completed" && data.file_token) {
                const downloadUrl = `/api/file/serve/${data.file_token}`;
                const link = document.createElement("a");
                link.href = downloadUrl;
                link.setAttribute("download", data.filename || "download");
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
        });
        wsRef.current.connect();
        return () => wsRef.current?.close();
    }, [clientId]);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(LAST_SELECTION_KEY);
            if (!raw) return;
            const j = JSON.parse(raw);
            if (j.mode === "audio") setDownloadMode("audio");
        } catch {
            // ignore
        }
    }, []);

    function persistSelection(mode: "video" | "audio", formatId: string) {
        try {
            window.localStorage.setItem(LAST_SELECTION_KEY, JSON.stringify({ mode, formatId }));
        } catch {
            // ignore
        }
    }

    async function onAnalyze() {
        const u = url.trim();
        if (!u) return;
        setIsAnalyzing(true);
        setStatus({ status: "idle", percent: 0 });
        setAnalysisData(null);
        setVideoInfo(null);
        setAvailableFormats([]);
        setAudioFormats([]);
        setSelectedFormatId(null);
        setLastError("");

        try {
            const data = await analyzeVideo(u);
            setVideoInfo({ title: data.title, thumbnail: data.thumbnail, description: data.description });
            setAnalysisData(data.analysis);
            setAvailableFormats(data.available_formats || []);
            setAudioFormats(data.audio_formats || []);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Analysis failed";
            setLastErrorStage("analyze");
            setLastError(msg);
            setStatus({ status: "error", percent: 0, error: msg });
        } finally {
            setIsAnalyzing(false);
        }
    }

    function onDownload() {
        const u = url.trim();
        if (!u || !wsRef.current) return;
        setLastError("");
        setStatus({ status: "initializing", percent: 0, speed: "", eta: "" });
        wsRef.current.sendDownloadSpec(u, {
            mode: downloadMode,
            format_id: selectedFormatId || undefined,
        });
    }

    return (
        <main className="min-h-screen pt-28 pb-14 px-4 flex flex-col items-center relative z-10">
            {/* Liquid glass backdrop */}
            <div className="pointer-events-none fixed inset-0 -z-10">
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full liquid-orb opacity-40" />
                <div className="absolute bottom-[-220px] right-[-180px] w-[700px] h-[700px] rounded-full liquid-orb opacity-30" />
            </div>

            <div className="w-full max-w-6xl space-y-10">
                <div className="text-center space-y-4 flex flex-col items-center">
                    <div className="mb-2">
                        <Logo />
                    </div>
                    <p className="text-zinc-400 text-sm tracking-[0.3em] uppercase font-mono">
                        Liquid Glass Downloader
                    </p>
                </div>

                <Card className="glass-panel rounded-2xl" spotlight={false}>
                    <div className="p-5 sm:p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div
                                className="flex-1"
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = "copy";
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const text = e.dataTransfer.getData("text");
                                    if (text) setUrl(text.trim());
                                }}
                            >
                                <Input
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="Paste a YouTube / TikTok / Instagram URL…"
                                    className="h-12 text-base bg-black/20 border-white/10 focus-visible:ring-white/20"
                                />
                            </div>
                            <Button className="h-12 px-6 text-sm font-semibold" onClick={onAnalyze} disabled={isAnalyzing || !url.trim()}>
                                {isAnalyzing ? "Analyzing..." : "Analyze"}
                            </Button>
                            <Button
                                variant="secondary"
                                className="h-12 px-6 text-sm"
                                onClick={() => setShowAdmin((v) => !v)}
                            >
                                {showAdmin ? "Hide" : "Show"} Logs
                            </Button>
                        </div>

                        {status.status === "error" && (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                                {status.error || "Error"}
                            </div>
                        )}
                    </div>
                </Card>

                {(videoInfo || isAnalyzing) && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        <div className="lg:col-span-7 space-y-6">
                            {videoInfo && (
                                <Card className="glass-panel rounded-2xl overflow-hidden" spotlight={false}>
                                    <div className="aspect-video relative bg-black/30">
                                        {videoInfo.thumbnail ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={videoInfo.thumbnail} alt={videoInfo.title} className="object-cover w-full h-full opacity-95" />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-zinc-600 font-mono text-xs">No Preview</div>
                                        )}
                                    </div>
                                    <div className="p-4 border-t border-white/10">
                                        <h3 className="text-zinc-100 font-semibold tracking-tight line-clamp-2">{videoInfo.title}</h3>
                                        {videoInfo.description && (
                                            <p className="text-zinc-500 text-xs mt-2 line-clamp-3">{videoInfo.description}</p>
                                        )}
                                    </div>
                                </Card>
                            )}

                            {!isAnalyzing && videoInfo && (
                                <Card className="glass-panel rounded-2xl" spotlight={false}>
                                    <div className="p-5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-semibold">Quality</div>
                                            <div className="text-[11px] text-zinc-500 font-mono">
                                                WebSocket: {wsRef.current?.isConnected ? "connected" : "reconnecting…"}
                                            </div>
                                        </div>
                                        <QualitySelector
                                            availableFormats={availableFormats}
                                            audioFormats={audioFormats}
                                            onSelect={(id, mode) => {
                                                setSelectedFormatId(id);
                                                setDownloadMode(mode);
                                                persistSelection(mode, id);
                                            }}
                                        />

                                        <Button
                                            onClick={onDownload}
                                            disabled={!selectedFormatId || status.status === "downloading" || status.status === "finishing" || status.status === "initializing"}
                                            className="w-full h-12 text-sm font-semibold"
                                        >
                                            {!selectedFormatId ? "Select a format" : "Download"}
                                        </Button>

                                        {(status.status === "downloading" || status.status === "finishing" || status.status === "initializing") && (
                                            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                                                <div className="flex justify-between text-zinc-400 text-xs font-mono">
                                                    <span className="uppercase tracking-wider">{status.status}</span>
                                                    <span className="text-zinc-500">
                                                        {[status.speed, status.eta].filter(Boolean).join(" • ")}
                                                    </span>
                                                </div>
                                                <div className="mt-3 h-1.5 w-full bg-white/10 rounded-full overflow-hidden border border-white/10">
                                                    <div
                                                        className="h-full bg-white/90 shadow-[0_0_18px_rgba(255,255,255,0.35)]"
                                                        style={{ width: `${Math.max(0, Math.min(100, status.percent || 0))}%` }}
                                                    />
                                                </div>
                                                <div className="text-right text-zinc-500 font-mono text-xs pt-2">
                                                    {(status.percent || 0).toFixed(1)}%
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            )}

                            {lastError && (
                                <AiFixPanel stage={lastErrorStage} url={url.trim()} error={lastError} />
                            )}
                        </div>

                        <div className="lg:col-span-5 space-y-6">
                            <AdminLogsPanel enabled={showAdmin} />
                            <InsightsPanel data={analysisData} isLoading={isAnalyzing} />
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
