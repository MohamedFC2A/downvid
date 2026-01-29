import type { VideoFormat } from "@/components/QualitySelector";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api` : "/api";

export type AnalyzeResult = {
    title: string;
    thumbnail?: string;
    description?: string;
    analysis: {
        summary: string[];
        sentiment: string;
        hashtags: string[];
    } | null;
    available_formats: VideoFormat[];
    audio_formats: VideoFormat[];
};

export async function analyzeVideo(url: string, opts?: { ai?: boolean; lang?: string }) {
    const qs = new URLSearchParams();
    if (typeof opts?.ai === "boolean") {
        qs.set("ai", opts.ai ? "true" : "false");
    }
    if (typeof opts?.lang === "string" && opts.lang.trim()) {
        qs.set("lang", opts.lang.trim());
    }
    const endpoint = qs.toString() ? `${API_BASE}/analyze?${qs.toString()}` : `${API_BASE}/analyze`;

    const res = await fetch(endpoint, {
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
