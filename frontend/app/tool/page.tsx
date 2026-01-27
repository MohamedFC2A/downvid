'use client';
import { useState, useEffect, useRef } from "react";
import { URLInput } from "@/components/modules/downloader/URLInput";
import { VideoPreview } from "@/components/modules/downloader/VideoPreview";
import { ProgressBar } from "@/components/modules/downloader/ProgressBar";
import { InsightsPanel } from "@/components/modules/ai/InsightsPanel";
import { QualitySelector, VideoFormat } from "@/components/QualitySelector";
import { analyzeVideo } from "@/lib/api";
import { WebSocketClient, DownloadStatus } from "@/lib/socket";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";

// Loader2 is not used, removing.

export default function ToolPage() {
    const [clientId] = useState(() => Math.random().toString(36).substring(7));
    const [status, setStatus] = useState<DownloadStatus>({ status: 'idle', percent: 0 });

    // Analysis State
    const [analysisData, setAnalysisData] = useState<any>(null);
    const [videoInfo, setVideoInfo] = useState<{ title: string, thumbnail: string, description?: string } | null>(null);
    const [availableFormats, setAvailableFormats] = useState<VideoFormat[]>([]);
    const [audioFormats, setAudioFormats] = useState<VideoFormat[]>([]);

    // User Selection State
    const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);
    const [downloadMode, setDownloadMode] = useState<'video' | 'audio'>('video');
    const [currentUrl, setCurrentUrl] = useState<string>("");

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const wsRef = useRef<WebSocketClient | null>(null);

    useEffect(() => {
        wsRef.current = new WebSocketClient(clientId, (data) => {
            setStatus(prev => ({ ...prev, ...data }));

            if (data.status === 'completed' && data.file_token) {
                // Trigger download
                const downloadUrl = `/api/file/serve/${data.file_token}`;
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.setAttribute('download', data.filename || 'download'); // filenames handled by server header usually
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
        });
        wsRef.current.connect();

        return () => {
            wsRef.current?.close();
        };
    }, [clientId]);

    const handleUrlSubmit = async (url: string) => {
        setIsAnalyzing(true);
        setAnalysisData(null);
        setVideoInfo(null);
        setAvailableFormats([]);
        setAudioFormats([]);
        setSelectedFormatId(null);
        setStatus({ status: 'idle', percent: 0 }); // Reset status
        setCurrentUrl(url);

        try {
            const data = await analyzeVideo(url);

            setVideoInfo({
                title: data.title,
                thumbnail: data.thumbnail,
                description: data.description
            });
            setAnalysisData(data.analysis);
            setAvailableFormats(data.available_formats || []);
            setAudioFormats(data.audio_formats || []); // Ensure backend returns snake_case

        } catch (e: any) {
            console.error(e);
            setStatus({ status: 'error', percent: 0, error: e.message || 'Analysis Failed' });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleDownload = () => {
        if (!currentUrl || !selectedFormatId || !wsRef.current) return;

        setStatus({ status: 'initializing', percent: 0, speed: 'Starting...' });
        wsRef.current.sendDownloadCommand(currentUrl, selectedFormatId, downloadMode);
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

                <div className="flex justify-center w-full">
                    <URLInput
                        onUrlSubmit={handleUrlSubmit}
                    />
                </div>

                {/* Error Display */}
                {status.status === 'error' && (
                    <div className="text-red-500 bg-red-500/10 p-4 rounded-lg text-center border border-red-500/20">
                        {status.error || "An error occurred"}
                    </div>
                )}

                {/* Content Logic */}
                {(videoInfo || isAnalyzing) && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start fade-in-up">

                        {/* Left Column: Preview & Controls (7 cols) */}
                        <div className="lg:col-span-7 space-y-6">
                            {/* Video Preview */}
                            {videoInfo && (
                                <VideoPreview
                                    title={videoInfo.title}
                                    thumbnail={videoInfo.thumbnail}
                                />
                            )}

                            {/* Format Selector */}
                            {!isAnalyzing && videoInfo && (
                                <QualitySelector
                                    availableFormats={availableFormats}
                                    audioFormats={audioFormats}
                                    onSelect={(id: string, mode: 'video' | 'audio') => {
                                        setSelectedFormatId(id);
                                        setDownloadMode(mode);
                                    }}
                                />
                            )}

                            {/* Download Action Area */}
                            {!isAnalyzing && videoInfo && (
                                <div className="pt-4">
                                    {status.status === 'idle' || status.status === 'error' || status.status === 'completed' ? (
                                        <Button
                                            onClick={handleDownload}
                                            disabled={!selectedFormatId}
                                            className={`w-full h-14 text-lg font-bold rounded-lg transition-all ${selectedFormatId
                                                ? 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                                                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                                }`}
                                        >
                                            {selectedFormatId ? 'Start Extraction' : 'Select Format to Download'}
                                        </Button>
                                    ) : (
                                        // Progress Bar
                                        <div className="p-6 bg-zinc-950/50 border border-zinc-900 rounded-xl">
                                            <ProgressBar
                                                progress={status.percent}
                                                status={status.status}
                                                speed={status.speed}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Loading State */}
                            {isAnalyzing && (
                                <div className="h-64 flex items-center justify-center bg-zinc-900/10 rounded-xl border border-zinc-800 border-dashed">
                                    <div className="flex flex-col items-center gap-4 text-zinc-500">
                                        <div className="animate-spin h-8 w-8 border-2 border-zinc-500 border-t-transparent rounded-full" />
                                        <p>Analyzing Metadata...</p>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Right Column: AI Insights (5 cols) */}
                        <div className="lg:col-span-5 h-full">
                            <InsightsPanel data={analysisData} isLoading={isAnalyzing} />
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

// Simple generic animation class injection if needed, or rely on global CSS
