import type { VideoFormat } from "@/components/QualitySelector";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api` : "/api";

export type AnalyzeResult = {
    title: string;
    thumbnail?: string;
    description?: string;
    platform?: string; // Added platform
    downloads?: {      // Added downloads object
        video: VideoFormat[];
        audio: VideoFormat[];
    };
    analysis: {
        summary: string[];
        sentiment: string;
        hashtags: string[];
    };
    available_formats: VideoFormat[];
    audio_formats: VideoFormat[];
};

export async function analyzeVideo(url: string) {
    const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
    });
    if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.detail || "Analysis failed");
    }
    return (await res.json()) as AnalyzeResult;
}

export async function getFileDownloadUrl(fileToken: string): Promise<string> {
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    return `${baseUrl}/api/file/serve/${fileToken}`;
}
