import type { VideoFormat } from "@/components/QualitySelector";
import { getSupabaseClient } from "@/lib/supabase";
import { apiUrl } from "@/lib/backend";

function bytesToHuman(bytes: number | null | undefined): string {
    if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return "Unknown";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let n = bytes;
    let u = 0;
    while (n >= 1024 && u < units.length - 1) {
        n /= 1024;
        u += 1;
    }
    const fixed = n >= 100 ? 0 : n >= 10 ? 1 : 2;
    return `${n.toFixed(fixed)} ${units[u]}`;
}

function toVideoFormat(f: BackendFormat): VideoFormat {
    const height = typeof f.height === "number" ? f.height : undefined;
    const width = typeof f.width === "number" ? f.width : undefined;
    const container = (f.container || "").toLowerCase();
    const resolution = height
        ? `${height}p`
        : (width && typeof f.height === "number")
            ? `${width}x${f.height}`
            : f.kind === "audio_only"
                ? "Audio"
                : "Unknown";
    const size = bytesToHuman(typeof f.filesize === "number" ? f.filesize : (typeof f.filesize_approx === "number" ? f.filesize_approx : undefined));
    const fps = typeof f.fps === "number" ? f.fps : undefined;
    const vcodec = f.video_codec || undefined;
    const acodec = f.audio_codec || undefined;
    const abr = typeof f.abr === "number" ? f.abr : undefined;
    const noteParts: string[] = [];
    if (f.kind === "video_only") noteParts.push("video-only");
    if (f.kind === "audio_only") noteParts.push("audio-only");
    if (typeof f.tbr === "number" && f.tbr > 0) noteParts.push(`${Math.round(f.tbr)}kbps`);
    const note = noteParts.join(" • ");
    return {
        format_id: String(f.format_id),
        resolution,
        filesize_str: size,
        note,
        extension: container || "bin",
        height,
        fps,
        vcodec,
        acodec,
        abr,
    };
}

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
    formats_count?: number;
    playable_formats_count?: number;
};

type BackendFormat = {
    format_id: string;
    container: string;
    video_codec?: string | null;
    audio_codec?: string | null;
    width?: number | null;
    height?: number | null;
    fps?: number | null;
    vbr?: number | null;
    abr?: number | null;
    tbr?: number | null;
    filesize?: number | null;
    filesize_approx?: number | null;
    kind: "muxed" | "video_only" | "audio_only" | "unknown";
};

type BackendAnalyzeResponse = {
    title: string;
    thumbnail?: string | null;
    description?: string | null;
    duration?: number | null;
    formats: BackendFormat[];
    formats_count?: number;
    playable_formats_count?: number;
    analysis?: AnalyzeResult["analysis"] | null;
};

export async function analyzeVideo(url: string, opts?: { ai?: boolean; lang?: string }) {
    const qs = new URLSearchParams();
    if (typeof opts?.ai === "boolean") {
        qs.set("ai", opts.ai ? "true" : "false");
    }
    if (typeof opts?.lang === "string" && opts.lang.trim()) {
        qs.set("lang", opts.lang.trim());
    }
    const endpoint = qs.toString() ? apiUrl(`/analyze?${qs.toString()}`) : apiUrl("/analyze");

    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ url }),
    });
    if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.detail || "Analysis failed");
    }
    const json = (await res.json()) as BackendAnalyzeResponse;

    const formats = Array.isArray(json.formats) ? json.formats : [];
    const mapped = formats.map(toVideoFormat);
    const available_formats = mapped.filter((f) => {
        const v = (f.vcodec || "").toLowerCase();
        return Boolean(v && v !== "none");
    });
    const audio_formats = mapped.filter((f) => {
        const v = (f.vcodec || "").toLowerCase();
        const a = (f.acodec || "").toLowerCase();
        return (!v || v === "none") && Boolean(a && a !== "none");
    });

    return {
        title: json.title,
        thumbnail: json.thumbnail || undefined,
        description: json.description || undefined,
        analysis: json.analysis ?? null,
        available_formats,
        audio_formats,
        // optional debug counters (not used by UI yet)
        formats_count: typeof json.formats_count === "number" ? json.formats_count : formats.length,
        playable_formats_count: typeof json.playable_formats_count === "number" ? json.playable_formats_count : undefined,
    } satisfies AnalyzeResult;
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
    const endpoint = qs.toString() ? apiUrl(`/summarize?${qs.toString()}`) : apiUrl("/summarize");

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

function parseFilenameFromContentDisposition(header: string | null): string | null {
    if (!header) return null;
    const h = header;
    const utf8 = h.match(/filename\\*=UTF-8''([^;]+)/i);
    if (utf8 && utf8[1]) {
        try {
            return decodeURIComponent(utf8[1].trim().replace(/^\"|\"$/g, ""));
        } catch {
            return utf8[1].trim().replace(/^\"|\"$/g, "");
        }
    }
    const m = h.match(/filename=([^;]+)/i);
    if (!m || !m[1]) return null;
    return m[1].trim().replace(/^\"|\"$/g, "");
}

export async function downloadSelected(opts: { url: string; selected_format_id: string; mode: "video" | "audio" }) {
    const res = await fetch(apiUrl("/download"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
            url: opts.url,
            selected_format_id: opts.selected_format_id,
            mode: opts.mode,
        }),
    });

    if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = (json?.detail || json?.error || `Download failed (${res.status})`).toString();
        throw new Error(msg);
    }

    const filename = parseFilenameFromContentDisposition(res.headers.get("content-disposition"));
    const blob = await res.blob();
    return { blob, filename };
}
