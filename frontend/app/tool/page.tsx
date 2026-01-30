'use client';
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InsightsPanel } from "@/components/modules/ai/InsightsPanel";
import { QualitySelector, type VideoFormat } from "@/components/QualitySelector";
import { analyzeVideo, downloadSelected, type AnalyzeResult } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useSettings } from "@/hooks/useSettings";
import { t } from "@/lib/i18n";
import { PlatformIcon, type PlatformId } from "@/components/PlatformIcon";
import { clampFormats, clearToolState, loadToolState, saveToolState } from "@/lib/toolState";
import { ErrorViewer, type DebugLogItem } from "@/components/modules/debug/ErrorViewer";
import { apiUrl } from "@/lib/backend";

const LAST_SELECTION_KEY = "downvid:lastSelection:v1";
const TOOL_STATE_DEBOUNCE_MS = 500;

export default function ToolPage() {
    const { settings, updateSettings } = useSettings();
    const auth = useAuth();
    const entitlements = useEntitlements();
    const lang = settings.language;
    const [url, setUrl] = useState("");
    const [restoredAt, setRestoredAt] = useState<string | null>(null);
    const [showRestoredBanner, setShowRestoredBanner] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisData, setAnalysisData] = useState<AnalyzeResult["analysis"] | null>(null);
    const [videoInfo, setVideoInfo] = useState<{ title: string; thumbnail?: string; description?: string } | null>(null);
    const [availableFormats, setAvailableFormats] = useState<VideoFormat[]>([]);
    const [audioFormats, setAudioFormats] = useState<VideoFormat[]>([]);
    const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);
    const [downloadMode, setDownloadMode] = useState<"video" | "audio">("video");
    const [platformDetected, setPlatformDetected] = useState<string | null>(null);
    const [lastError, setLastError] = useState<string>("");
    const [isDownloading, setIsDownloading] = useState(false);
    const [showLogs, setShowLogs] = useState(false);
    const [logs, setLogs] = useState<DebugLogItem[]>([]);
    const isDataSaver = settings.dataSaver;
    const saveTimerRef = useRef<number | null>(null);
    const urlTrimmed = url.trim();
    const isUrlValid = /^https?:\/\/\S+/i.test(urlTrimmed);

    const pushLog = useCallback((item: Omit<DebugLogItem, "ts">) => {
        setLogs((prev) => [{ ts: new Date().toISOString(), ...item }, ...prev].slice(0, 120));
    }, []);

    useEffect(() => {
        function onError(ev: ErrorEvent) {
            const msg = ev?.message || "Unknown error";
            pushLog({
                level: "error",
                title: "window.error",
                detail: msg,
                data: {
                    filename: ev?.filename,
                    lineno: ev?.lineno,
                    colno: ev?.colno,
                },
            });
        }
        function onRejection(ev: PromiseRejectionEvent) {
            const reason = (ev?.reason && typeof ev.reason === "object") ? JSON.stringify(ev.reason) : String(ev?.reason || "Unknown rejection");
            pushLog({ level: "error", title: "unhandledrejection", detail: reason });
        }
        window.addEventListener("error", onError);
        window.addEventListener("unhandledrejection", onRejection);
        return () => {
            window.removeEventListener("error", onError);
            window.removeEventListener("unhandledrejection", onRejection);
        };
    }, [pushLog]);

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

    const platformId: PlatformId = platformDetected === 'YouTube'
        ? 'youtube'
        : platformDetected === 'TikTok'
            ? 'tiktok'
            : platformDetected === 'Instagram'
                ? 'instagram'
                : platformDetected === 'Facebook'
                    ? 'facebook'
                    : platformDetected === 'Twitter'
                        ? 'x'
                        : 'unknown';

    useEffect(() => {
        const restored = loadToolState();
        if (restored && restored.url) {
            setUrl(restored.url);
            setVideoInfo(restored.videoInfo);
            setAnalysisData(restored.analysisData);
            setAvailableFormats(restored.availableFormats || []);
            setAudioFormats(restored.audioFormats || []);
            setSelectedFormatId(restored.selectedFormatId || null);
            setDownloadMode(restored.downloadMode || "video");
            if (restored.savedAt) {
                setRestoredAt(restored.savedAt);
                setShowRestoredBanner(true);
            }
        }
    }, []);

    useEffect(() => {
        // Persist tool state so users can navigate away and resume.
        if (typeof window === "undefined") return;
        if (saveTimerRef.current) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        saveTimerRef.current = window.setTimeout(() => {
            saveToolState({
                v: 1,
                savedAt: new Date().toISOString(),
                url: url.trim(),
                language: lang,
                videoInfo,
                analysisData,
                availableFormats: clampFormats(availableFormats, 60),
                audioFormats: clampFormats(audioFormats, 60),
                selectedFormatId,
                downloadMode,
                downloadedFile: null,
            });
        }, TOOL_STATE_DEBOUNCE_MS);

        return () => {
            if (saveTimerRef.current) {
                window.clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
        };
    }, [url, lang, videoInfo, analysisData, availableFormats, audioFormats, selectedFormatId, downloadMode]);

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

    function parseBytes(str: string): number {
        const raw = (str || "").trim();
        const m = raw.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
        if (!m) return 0;
        const n = Number(m[1]);
        if (!Number.isFinite(n) || n <= 0) return 0;
        const unit = m[2].toUpperCase();
        const pow = unit === "B" ? 0 : unit === "KB" ? 1 : unit === "MB" ? 2 : unit === "GB" ? 3 : 4;
        return Math.floor(n * Math.pow(1024, pow));
    }

    function getHeight(fmt: VideoFormat): number {
        if (typeof fmt.height === "number" && fmt.height > 0) return fmt.height;
        const m = (fmt.resolution || "").match(/(\d{3,4})p/i);
        if (m) {
            const v = Number.parseInt(m[1], 10);
            return Number.isFinite(v) ? v : 0;
        }
        if (/8k/i.test(fmt.resolution || "")) return 4320;
        if (/4k/i.test(fmt.resolution || "")) return 2160;
        return 0;
    }

    function hasDownloadLink(fmt: VideoFormat | null | undefined): boolean {
        return Boolean(fmt?.format_id && String(fmt.format_id).trim().length > 0);
    }

    function hasAudio(fmt: VideoFormat): boolean {
        const a = (fmt.acodec || "").toLowerCase();
        return Boolean(a && a !== "none");
    }

    function pickDefaultVideoFormatId(list: VideoFormat[]): string | null {
        const candidates = list.filter((f) => hasDownloadLink(f));
        if (candidates.length === 0) return null;

        const preferredHeights = [1080, 720, 2160, 480, 360, 240];
        for (const h of preferredHeights) {
            const same = candidates.filter((f) => getHeight(f) === h);
            if (same.length === 0) continue;
            same.sort((a, b) => {
                const audio = Number(hasAudio(b)) - Number(hasAudio(a));
                if (audio !== 0) return audio;
                const mp4 = Number((b.extension || "").toLowerCase() === "mp4") - Number((a.extension || "").toLowerCase() === "mp4");
                if (mp4 !== 0) return mp4;
                const fps = (b.fps || 0) - (a.fps || 0);
                if (fps !== 0) return fps;
                return parseBytes(b.filesize_str || "") - parseBytes(a.filesize_str || "");
            });
            return same[0]!.format_id;
        }

        candidates.sort((a, b) => {
            const audio = Number(hasAudio(b)) - Number(hasAudio(a));
            if (audio !== 0) return audio;
            const h = getHeight(b) - getHeight(a);
            if (h !== 0) return h;
            const mp4 = Number((b.extension || "").toLowerCase() === "mp4") - Number((a.extension || "").toLowerCase() === "mp4");
            if (mp4 !== 0) return mp4;
            return parseBytes(b.filesize_str || "") - parseBytes(a.filesize_str || "");
        });
        return candidates[0]!.format_id;
    }

    function pickDefaultAudioFormatId(list: VideoFormat[]): string | null {
        const candidates = list.filter((f) => hasDownloadLink(f));
        if (candidates.length === 0) return null;
        candidates.sort((a, b) => {
            const abr = (b.abr || 0) - (a.abr || 0);
            if (abr !== 0) return abr;
            return parseBytes(b.filesize_str || "") - parseBytes(a.filesize_str || "");
        });
        return candidates[0]!.format_id;
    }

    async function onAnalyze() {
        const u = url.trim();
        if (!u || !isUrlValid) return;
        setIsAnalyzing(true);
        setAnalysisData(null);
        setVideoInfo(null);
        setAvailableFormats([]);
        setAudioFormats([]);
        setSelectedFormatId(null);
        setLastError("");

        try {
            pushLog({
                level: "info",
                title: "analyze.start",
                detail: u,
                data: { ai: settings.aiInsightsEnabled && entitlements.aiEnabled, lang: settings.language },
            });
            const data = await analyzeVideo(u, {
                ai: settings.aiInsightsEnabled && entitlements.aiEnabled,
                lang: settings.language,
            });
            setVideoInfo({
                title: data.title,
                thumbnail: data.thumbnail,
                description: data.description || t(lang, "tool.source", { source: platformDetected || t(lang, "tool.unknown") })
            });

            setAnalysisData(data.analysis || null);
            setAvailableFormats(data.available_formats || []);
            setAudioFormats(data.audio_formats || []);

            if ((data.available_formats?.length || 0) === 0 && (data.audio_formats?.length || 0) === 0) {
                const hint =
                    platformDetected === "YouTube"
                        ? (lang === "ar"
                            ? "يوتيوب على السيرفر قد يمنع استخراج الجودات (IP داتا سنتر). جرّب رابط/منصة أخرى، أو شغّل الباكند على جهازك/سيرفر منزلي. (Proxy اختياري)."
                            : "YouTube may block quality extraction from datacenter IPs. Try another platform, or run the backend on a home IP. (Proxy optional).")
                        : "";
                if (hint) setLastError(hint);
            }

            const nextVideo = Array.isArray(data.available_formats) ? pickDefaultVideoFormatId(data.available_formats) : null;
            const nextAudio = Array.isArray(data.audio_formats) ? pickDefaultAudioFormatId(data.audio_formats) : null;
            const next = downloadMode === "audio" ? nextAudio : nextVideo;
            if (next) {
                setSelectedFormatId(next);
                persistSelection(downloadMode, next);
            }
            pushLog({
                level: "info",
                title: "analyze.ok",
                data: {
                    video_formats: Array.isArray(data.available_formats) ? data.available_formats.length : 0,
                    audio_formats: Array.isArray(data.audio_formats) ? data.audio_formats.length : 0,
                    raw_formats: typeof (data as any)?.formats_count === "number" ? (data as any).formats_count : undefined,
                },
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t(lang, "tool.analysisFailed");
            setLastError(msg);
            pushLog({ level: "error", title: "analyze.error", detail: msg });
        } finally {
            setIsAnalyzing(false);
        }
    }

    const selectedFormat = useMemo(() => {
        const list = downloadMode === "audio" ? audioFormats : availableFormats;
        return list.find((f) => f.format_id === selectedFormatId) || null;
    }, [audioFormats, availableFormats, downloadMode, selectedFormatId]);

    async function onDownload() {
        if (auth.configured && !auth.user) {
            setLastError(t(lang, "subs.loginRequired"));
            return;
        }
        if (!selectedFormatId || !selectedFormat || !isUrlValid) {
            setLastError(t(lang, "tool.pickFormat"));
            return;
        }
        if (entitlements.plan === "free" && entitlements.downloadsRemaining === 0) {
            setLastError(t(lang, "subs.freeLimitReached"));
            return;
        }

        setLastError("");
        setIsDownloading(true);
        try {
            pushLog({
                level: "info",
                title: "download.click",
                data: {
                    mode: downloadMode,
                    format_id: selectedFormatId,
                    url_host: (() => {
                        try {
                            return new URL(urlTrimmed).host;
                        } catch {
                            return "invalid";
                        }
                    })(),
                    has_token: Boolean(auth.accessToken),
                    plan: entitlements.plan,
                },
            });
            const title = (videoInfo?.title || "downvid").trim();
            const ext = (selectedFormat.extension || "mp4").toString().replace(/^\./, "") || "mp4";
            const resolution = (selectedFormat.resolution || "").toString().replace(/[^\w.-]+/g, "_").slice(0, 24);
            const base = title
                .replace(/[\\/:*?\"<>|]+/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 90);
            const fallbackFilename = `${base}${resolution ? `_${resolution}` : ""}.${ext}`;

            pushLog({ level: "info", title: "download.endpoint", data: { endpoint: "/api/download" } });

            const { blob, filename } = await downloadSelected({
                url: urlTrimmed,
                selected_format_id: selectedFormatId,
                mode: downloadMode,
            });

            const finalName = (filename || fallbackFilename).toString().trim() || fallbackFilename;
            const href = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = href;
            a.download = finalName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.setTimeout(() => URL.revokeObjectURL(href), 2000);

            window.setTimeout(() => void entitlements.refresh(), 800);
            setIsDownloading(false);
        } catch (e) {
            setIsDownloading(false);
            setLastError(e instanceof Error ? e.message : t(lang, "tool.downloadUrlFailed"));
            pushLog({ level: "error", title: "download.error", detail: e instanceof Error ? e.message : "download failed" });
            try {
                const res = await fetch(apiUrl("/diagnostics"));
                const json = await res.json().catch(() => null);
                pushLog({ level: res.ok ? "info" : "warn", title: "server.diagnostics", data: json || undefined });
            } catch {
                // ignore diagnostics failure
            }
        }
    }

    const inputAccent = isUrlValid ? 'border-green-500/45 focus-visible:border-green-600/55' : '';

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

    const pasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && /^https?:\/\//i.test(text)) {
                setUrl(text.trim());
            }
        } catch {
            // Clipboard access may be blocked.
        }
    };

    return (
        <main className="min-h-screen pt-28 pb-14 px-4 flex flex-col items-center relative z-10">
            {/* Keep background clean: no glow blobs */}

            <div className="w-full max-w-6xl space-y-10">
                <div className="text-center space-y-4 flex flex-col items-center">
                    <div className="mb-2">
                        <Logo />
                    </div>
                    <p className={`text-[var(--foreground)] opacity-60 text-sm font-mono ${lang === "ar" ? "" : "tracking-[0.3em] uppercase"}`}>
                        {t(lang, "tool.tagline")}
                    </p>
                </div>

                <Card className="glass-panel rounded-2xl" spotlight={false}>
                    <div className="p-5 sm:p-6 space-y-4">
                        {showRestoredBanner && restoredAt && (
                            <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--deep)] px-4 py-3 flex items-start justify-between gap-3">
                                <div className="text-sm text-[var(--foreground)] opacity-80">
                                    {t(lang, "tool.restored", { time: new Date(restoredAt).toLocaleString() })}
                                </div>
                                <button
                                    type="button"
                                    className="shrink-0 text-xs font-mono text-[var(--foreground)] opacity-60 hover:opacity-90"
                                    onClick={() => setShowRestoredBanner(false)}
                                >
                                    {t(lang, "tool.dismiss")}
                                </button>
                            </div>
                        )}

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
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                void onAnalyze();
                                            }
                                        }}
                                        onPaste={(e) => {
                                            const text = e.clipboardData.getData("text");
                                            if (text) setUrl(text.trim());
                                        }}
                                        onFocus={handleFocus}
                                        placeholder={t(lang, "tool.urlPlaceholder")}
                                        className={`h-14 text-lg bg-[var(--panel)] border-[var(--panel-border)] focus-visible:ring-[var(--accent-soft)] backdrop-blur-xl transition-all pl-12 pr-28 rounded-xl ${inputAccent}`}
                                    />
                                    {/* Platform Icon Indicator */}
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--foreground)] opacity-55 pointer-events-none transition-colors duration-300">
                                        {platformDetected ? (
                                            <span className="text-[var(--foreground)] opacity-90">
                                                <div className="w-7 h-7 flex items-center justify-center rounded border border-[var(--panel-border)] bg-[var(--panel)]">
                                                    <PlatformIcon platform={platformId} className="w-5 h-5" />
                                                </div>
                                            </span>
                                        ) : (
                                            <svg className="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                                        )}
                                    </div>

                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        <button
                                            type="button"
                                            className="h-9 px-3 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] text-xs font-mono text-[var(--foreground)] opacity-75 hover:opacity-95"
                                            onClick={() => void pasteFromClipboard()}
                                        >
                                            {t(lang, "tool.paste")}
                                        </button>

                                        {isUrlValid && (
                                            <div className="inline-flex items-center gap-1.5 rounded-full border border-green-500/25 bg-green-500/10 px-2 py-1">
                                                <svg className="w-3.5 h-3.5 text-green-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                                                <span className={`text-[10px] font-bold ${lang === "ar" ? "" : "uppercase tracking-wider"} text-green-700`}>{t(lang, "tool.urlValid")}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <Button className="h-12 px-6 text-sm font-semibold" onClick={onAnalyze} disabled={isAnalyzing || !isUrlValid}>
                                {isAnalyzing ? t(lang, "tool.analyzing") : t(lang, "tool.analyze")}
                            </Button>
                            <Button
                                variant="secondary"
                                className="h-12 px-6 text-sm"
                                onClick={() => {
                                    clearToolState();
                                    setRestoredAt(null);
                                    setShowRestoredBanner(false);
                                    setUrl("");
                                    setVideoInfo(null);
                                    setAnalysisData(null);
                                    setAvailableFormats([]);
                                    setAudioFormats([]);
                                    setSelectedFormatId(null);
                                    setLastError("");
                                }}
                                disabled={!url && !videoInfo && availableFormats.length === 0 && audioFormats.length === 0}
                            >
                                {t(lang, "tool.clear")}
                            </Button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="text-[11px] font-mono text-[var(--foreground)] opacity-60">
                                {platformDetected ? t(lang, "tool.platform", { platform: platformDetected }) : isUrlValid ? t(lang, "tool.platform", { platform: t(lang, "tool.detecting") }) : ""}
                            </div>
                        </div>
                        {urlTrimmed && !isUrlValid && (
                            <div className="text-xs text-[var(--foreground)] opacity-60">
                                {t(lang, "tool.invalidUrlHint")}
                            </div>
                        )}

                        {lastError && (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
                                {lastError}
                            </div>
                        )}
                    </div>
                </Card>

                {!videoInfo && !isAnalyzing && (
                    <Card className="glass-panel rounded-2xl" spotlight={false}>
                        <div className="p-6 space-y-3">
                            <div className="text-sm font-semibold text-[var(--foreground)]">{t(lang, "tool.quickStart")}</div>
                            <div className="text-sm text-[var(--foreground)] opacity-70 space-y-1">
                                <div>{t(lang, "tool.step1")}</div>
                                <div>{t(lang, "tool.step2")}</div>
                                <div>{t(lang, "tool.step3")}</div>
                            </div>
                        </div>
                    </Card>
                )}

                {(videoInfo || isAnalyzing) && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        <div className="lg:col-span-7 space-y-6">
                            {videoInfo && (
                                <Card className="glass-panel rounded-2xl overflow-hidden" spotlight={false}>
                                    <div className="aspect-video relative bg-[var(--deep)]">
                                        {videoInfo.thumbnail && !isDataSaver ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={videoInfo.thumbnail} alt={videoInfo.title} className="object-cover w-full h-full opacity-95" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-[var(--foreground)] opacity-60 font-mono text-xs gap-3 px-4 text-center">
                                                <div>
                                                    {isDataSaver ? t(lang, "tool.previewHidden") : t(lang, "tool.noPreview")}
                                                </div>
                                                {isDataSaver && (
                                                    <Button
                                                        variant="secondary"
                                                        className="h-8 px-3 text-[11px]"
                                                        onClick={() => updateSettings({ dataSaver: false })}
                                                    >
                                                        {t(lang, "tool.disableDataSaver")}
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 border-t border-[var(--panel-border)]">
                                        <h3 className="text-[var(--foreground)] font-semibold tracking-tight line-clamp-2">{videoInfo.title}</h3>
                                        {videoInfo.description && (
                                            <p className="text-[var(--foreground)] opacity-60 text-xs mt-2 line-clamp-3">{videoInfo.description}</p>
                                        )}
                                    </div>
                                </Card>
                            )}

                            {!isAnalyzing && videoInfo && (
                                <Card className="glass-panel rounded-2xl" spotlight={false}>
                                    <div className="p-5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-semibold">{t(lang, "tool.quality")}</div>
                                        </div>
                                        {auth.configured && (
                                            <div className="text-[11px] font-mono text-[var(--foreground)] opacity-65">
                                                {auth.user ? (
                                                    entitlements.plan === "ultimate" ? (
                                                        <span>
                                                            <span className="ultimate-silver">ULTIMATE</span>
                                                            <span className="opacity-75"> · </span>
                                                            <span className="opacity-75">{t(lang, "subs.unlimitedDownloads")}</span>
                                                        </span>
                                                    ) : (
                                                        t(lang, "subs.planFreeRemaining", { remaining: String(entitlements.downloadsRemaining ?? 0) })
                                                    )
                                                ) : (
                                                    <Link href="/auth" className="underline underline-offset-4">
                                                        {t(lang, "subs.loginToUse")}
                                                    </Link>
                                                )}
                                            </div>
                                        )}
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

                                        {lastError && (
                                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
                                                {lastError}
                                            </div>
                                        )}

                                        <Button
                                            onClick={onDownload}
                                            disabled={isAnalyzing || isDownloading}
                                            className="w-full h-12 text-sm font-semibold"
                                        >
                                            {isDownloading ? t(lang, "status.downloading") : t(lang, "tool.downloadSelected")}
                                        </Button>

                                        <div className="text-[11px] text-[var(--foreground)] opacity-60">
                                            {t(lang, "tool.downloadNote")}
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <button
                                                type="button"
                                                className="text-[11px] font-semibold text-[var(--foreground)] opacity-80 hover:opacity-100 underline underline-offset-4"
                                                onClick={() => setShowLogs((v) => !v)}
                                            >
                                                {showLogs ? t(lang, "tool.hideLogs") : t(lang, "tool.showLogs")}
                                            </button>
                                            <div className="text-[10px] font-mono text-[var(--foreground)] opacity-55">
                                                {logs.length > 0 ? `${logs.length}` : ""}
                                            </div>
                                        </div>

                                        {showLogs && (
                                            <ErrorViewer
                                                items={logs}
                                                onClear={() => setLogs([])}
                                            />
                                        )}
                                    </div>
                                </Card>
                            )}

                        </div>

                        <div className="lg:col-span-5 space-y-6">
                            {settings.aiInsightsEnabled && entitlements.aiEnabled && (
                                <InsightsPanel
                                    data={analysisData}
                                    isLoading={isAnalyzing}
                                    url={url.trim()}
                                    language={settings.language}
                                    aiEnabled={settings.aiInsightsEnabled}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
