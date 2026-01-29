import type { VideoFormat } from "@/components/QualitySelector";
import { getSupabaseClient } from "@/lib/supabase";

const API_BASE = "/api";

async function authHeaders(): Promise<Record<string, string>> {
    const supabase = getSupabaseClient();
    if (!supabase) return {};
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export type AnalyzeResult = {
    title: string;
    thumbnail?: string;
    description?: string;
    analysis: {
        summary: string[];
        sentiment: string;
        topics?: string[];
        keywords?: string[];
        hashtags: string[];
        hook?: string;
        safety_notes?: string[];
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
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ url }),
    });
    if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.detail || "Analysis failed");
    }
    return (await res.json()) as AnalyzeResult;
}

export type SummarizeResult = {
    title?: string;
    source?: "transcript" | "metadata_fallback";
    has_transcript?: boolean;
    summary?: string[];
    key_moments?: string[];
    takeaways?: string[];
    hashtags?: string[];
    topics?: string[];
    notes?: string;
};

export async function summarizeVideo(url: string, opts?: { ai?: boolean; lang?: string }) {
    const qs = new URLSearchParams();
    if (typeof opts?.ai === "boolean") {
        qs.set("ai", opts.ai ? "true" : "false");
    }
    if (typeof opts?.lang === "string" && opts.lang.trim()) {
        qs.set("lang", opts.lang.trim());
    }
    const endpoint = qs.toString() ? `${API_BASE}/summarize?${qs.toString()}` : `${API_BASE}/summarize`;

    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ url }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(json?.detail || "Summarize failed");
    }
    return json as SummarizeResult;
}
