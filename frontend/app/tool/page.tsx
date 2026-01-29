'use client';
import { useEffect, useMemo, useRef, useState } from "react";
import { InsightsPanel } from "@/components/modules/ai/InsightsPanel";
import { QualitySelector, type VideoFormat } from "@/components/QualitySelector";
import { analyzeVideo, getFileDownloadUrl, type AnalyzeResult } from "@/lib/api";
import { WebSocketClient, type DownloadStatus } from "@/lib/socket";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { AdminLogsPanel } from "@/components/modules/debug/AdminLogsPanel";
import { AiFixPanel } from "@/components/modules/debug/AiFixPanel";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { UpscaleButton } from "@/components/UpscaleButton";
import { useSettings } from "@/hooks/useSettings";
import { t } from "@/lib/i18n";

const LAST_SELECTION_KEY = "downvid:lastSelection:v1";

export default function ToolPage() {
    const { settings } = useSettings();
    const lang = settings.language;
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
    const [platformDetected, setPlatformDetected] = useState<string | null>(null);
    const [downloadedFile, setDownloadedFile] = useState<{ token: string; filename?: string } | null>(null);

    const [lastErrorStage, setLastErrorStage] = useState<"analyze" | "download" | "ws" | "other">("other");
    const [lastError, setLastError] = useState<string>("");
    const isDataSaver = settings.dataSaver;

    // Auto-Platform Detection
    useEffect(() => {
        const u = url.toLowerCase();
        if (u.includes('youtube.com') || u.includes('youtu.be')) setPlatformDetected('YouTube');
        else if (u.includes('tiktok.com')) setPlatformDetected('TikTok');
        else if (u.includes('instagram.com')) setPlatformDetected('Instagram');
        else if (u.includes('facebook.com') || u.includes('fb.watch')) setPlatformDetected('Facebook');
        else if (u.includes('twitter.com') || u.includes('x.com')) setPlatformDetected('Twitter');
        else setPlatformDetected(null);
    }, [url]);

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
                setDownloadedFile({ token: data.file_token, filename: data.filename });
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
            if (j.mode === "audio" || j.mode === "video") {
                setDownloadMode(j.mode);
            }
            if (typeof j.formatId === "string" && j.formatId.length > 0) {
                setSelectedFormatId(j.formatId);
            }
        } catch {
            // ignore
        }
    }, []);

    function persistSelection(mode: "video" | "audio", formatId: string | null) {
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
        setDownloadedFile(null);
        setAvailableFormats([]);
        setAudioFormats([]);
        setSelectedFormatId(null);
        setLastError("");

        try {
            const data = await analyzeVideo(u, { ai: settings.aiInsightsEnabled, lang: settings.language });
            setVideoInfo({
                title: data.title,
                thumbnail: data.thumbnail,
                description: data.description || `Source: ${platformDetected || 'Unknown'}`
            });

            setAnalysisData(data.analysis || null);
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
        setDownloadedFile(null);
        setStatus({ status: "initializing", percent: 0, speed: "", eta: "" });
        wsRef.current.sendDownloadSpec(u, {
            mode: downloadMode,
            format_id: selectedFormatId || undefined,
        });
    }

    async function onDownloadFile() {
        if (!downloadedFile?.token) return;
        try {
            const downloadUrl = await getFileDownloadUrl(downloadedFile.token);
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.setAttribute("download", downloadedFile.filename || "download");
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch {
            setLastErrorStage("download");
            setLastError("Failed to build download URL");
        }
    }

    const platformAccent = platformDetected === 'YouTube'
        ? 'border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.18)] focus-visible:ring-red-400/50'
        : platformDetected === 'TikTok'
            ? 'border-cyan-400/40 shadow-[0_0_20px_rgba(34,211,238,0.18)] focus-visible:ring-cyan-400/50'
            : platformDetected === 'Instagram'
                ? 'border-pink-400/40 shadow-[0_0_20px_rgba(244,114,182,0.18)] focus-visible:ring-pink-400/50'
                : platformDetected === 'Facebook'
                    ? 'border-blue-400/40 shadow-[0_0_20px_rgba(96,165,250,0.18)] focus-visible:ring-blue-400/50'
                    : platformDetected === 'Twitter'
                        ? 'border-sky-400/40 shadow-[0_0_20px_rgba(56,189,248,0.18)] focus-visible:ring-sky-400/50'
                        : '';

    const handleFocus = async () => {
        if (!settings.autoPaste) return;
        try {
            const text = await navigator.clipboard.readText();
            if (text && /^https?:\/\//i.test(text) && text.trim() !== url.trim()) {
                setUrl(text.trim());
            }
        } catch {
            // Clipboard access may be blocked.
        }
    };

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
                    <p className="text-[var(--foreground)] opacity-60 text-sm tracking-[0.3em] uppercase font-mono">
                        {t(lang, "tool.tagline")}
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
                                <div className="relative group">
                                    <Input
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        onPaste={(e) => {
                                            const text = e.clipboardData.getData("text");
                                            if (text) setUrl(text.trim());
                                        }}
                                        onFocus={handleFocus}
                                        placeholder={t(lang, "tool.urlPlaceholder")}
                                        className={`h-14 text-lg bg-[var(--panel)] border-[var(--panel-border)] focus-visible:ring-[var(--accent-soft)] backdrop-blur-xl transition-all pl-12 pr-12 rounded-xl ${platformDetected ? platformAccent : ''}`}
                                    />
                                    {/* Platform Icon Indicator */}
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none transition-colors duration-300">
                                        {platformDetected ? (
                                            <span className="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">
                                                {/* Simple SVG Icons based on platform could go here, for now using initial char in a styled box */}
                                                <div className="w-6 h-6 flex items-center justify-center font-bold font-mono border border-cyan-400 rounded bg-cyan-900/40">
                                                    {platformDetected[0]}
                                                </div>
                                            </span>
                                        ) : (
                                            <svg className="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                                        )}
                                    </div>

                                    {/* Verified Badge */}
                                    {platformDetected && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-green-400 bg-green-950/30 px-2 py-1 rounded-full border border-green-500/20 animate-in fade-in zoom-in duration-300">
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                                            <span className="text-[10px] uppercase font-bold tracking-wider">{t(lang, "tool.verified")}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <Button className="h-12 px-6 text-sm font-semibold" onClick={onAnalyze} disabled={isAnalyzing || !url.trim()}>
                                {isAnalyzing ? t(lang, "tool.analyzing") : t(lang, "tool.analyze")}
                            </Button>
                            <Button
                                variant="secondary"
                                className="h-12 px-6 text-sm"
                                onClick={() => setShowAdmin((v) => !v)}
                            >
                                {showAdmin ? t(lang, "tool.hideLogs") : t(lang, "tool.showLogs")}
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
                                        {videoInfo.thumbnail && !isDataSaver ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={videoInfo.thumbnail} alt={videoInfo.title} className="object-cover w-full h-full opacity-95" />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-zinc-600 font-mono text-xs">
                                                {isDataSaver ? 'Preview hidden (Data Saver)' : 'No Preview'}
                                            </div>
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
                                                WebSocket: {wsRef.current?.isConnected ? t(lang, "tool.wsConnected") : t(lang, "tool.wsReconnecting")}
                                            </div>
                                        </div>
                                        <QualitySelector
                                            availableFormats={availableFormats}
                                            audioFormats={audioFormats}
                                            mode={downloadMode}
                                            selectedId={selectedFormatId}
                                            language={settings.language}
                                            onModeChange={(newMode) => {
                                                setDownloadMode(newMode);
                                                setSelectedFormatId(null);
                                                persistSelection(newMode, null);
                                            }}
                                            onSelect={(id, mode) => {
                                                setSelectedFormatId(id);
                                                setDownloadMode(mode);
                                                persistSelection(mode, id);
                                            }}
                                        />

                                        {settings.upscaleEnabled && (
                                            <UpscaleButton
                                                videoUrl={url.trim()}
                                                fileToken={downloadedFile?.token || undefined}
                                                disabled={isAnalyzing || !url.trim() || !downloadedFile?.token}
                                            />
                                        )}

                                        <Button
                                            onClick={onDownload}
                                            disabled={
                                                status.status === "downloading"
                                                || status.status === "finishing"
                                                || status.status === "initializing"
                                            }
                                            className="w-full h-12 text-sm font-semibold"
                                        >
                                            {selectedFormatId ? t(lang, "tool.downloadSelected") : t(lang, "tool.downloadBest")}
                                        </Button>

                                        {downloadedFile?.token && status.status === "completed" && (
                                            <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--deep)] p-4 space-y-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="text-xs uppercase tracking-widest text-zinc-500 font-mono">{t(lang, "tool.ready")}</div>
                                                        <div className="text-sm font-semibold text-zinc-100 break-all">
                                                            {downloadedFile.filename || t(lang, "tool.downloadReady")}
                                                        </div>
                                                    </div>
                                                    <Button className="h-9 px-4 text-xs" onClick={onDownloadFile}>
                                                        {t(lang, "tool.downloadFile")}
                                                    </Button>
                                                </div>
                                                <div className="text-[11px] text-zinc-500 font-mono break-all">
                                                    {t(lang, "tool.token")}: {downloadedFile.token}
                                                </div>
                                            </div>
                                        )}

                                        {(status.status === "downloading" || status.status === "finishing" || status.status === "initializing") && (
                                            <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--deep)] p-4">
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

                            {settings.aiFixEnabled && lastError && (
                                <AiFixPanel stage={lastErrorStage} url={url.trim()} error={lastError} />
                            )}
                        </div>

                        <div className="lg:col-span-5 space-y-6">
                            <AdminLogsPanel enabled={showAdmin} />
                            {settings.aiInsightsEnabled && (
                                <InsightsPanel data={analysisData} isLoading={isAnalyzing} />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
