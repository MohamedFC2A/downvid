import type { AppLanguage } from "@/lib/settings";
import type { AnalyzeResult } from "@/lib/api";
import type { VideoFormat } from "@/components/QualitySelector";

export const TOOL_STATE_KEY = "downvid:toolState:v1";

export type ToolState = {
    v: 1;
    savedAt: string;
    url: string;
    language: AppLanguage;
    videoInfo: { title: string; thumbnail?: string; description?: string } | null;
    analysisData: AnalyzeResult["analysis"] | null;
    availableFormats: VideoFormat[];
    audioFormats: VideoFormat[];
    selectedFormatId: string | null;
    downloadMode: "video" | "audio";
    downloadedFile: { token: string; filename?: string } | null;
};

export function loadToolState(): ToolState | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(TOOL_STATE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as ToolState;
        if (!parsed || parsed.v !== 1) return null;
        if (typeof parsed.url !== "string") return null;
        return parsed;
    } catch {
        return null;
    }
}

export function saveToolState(state: ToolState) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(TOOL_STATE_KEY, JSON.stringify(state));
    } catch {
        // ignore
    }
}

export function clearToolState() {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(TOOL_STATE_KEY);
    } catch {
        // ignore
    }
}

export function clampFormats(formats: VideoFormat[], max: number) {
    if (!Array.isArray(formats)) return [];
    return formats.slice(0, Math.max(0, max));
}

