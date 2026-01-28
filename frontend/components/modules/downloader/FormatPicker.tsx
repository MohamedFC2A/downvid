'use client';

import { useMemo } from "react";
import { VideoFormat } from "@/components/QualitySelector";

export type DownloadPrefs = {
    mode: "video" | "audio";
    container: "mp4" | "webm" | "mp3" | "m4a";
    height: number; // for video
};

type BackendFormat = VideoFormat & { height?: number };

function pickClosestFormat(formats: BackendFormat[], container: string, height: number): BackendFormat | null {
    const candidates = formats.filter((f) => (container ? f.extension === container : true));
    if (candidates.length === 0) return null;

    const withHeights = candidates
        .map((f) => ({ f, h: f.height }))
        .filter((x) => typeof x.h === "number" && x.h > 0);

    if (withHeights.length === 0) return candidates[0];

    withHeights.sort((a, b) => {
        const da = Math.abs(height - (a.h || 0));
        const db = Math.abs(height - (b.h || 0));
        if (da !== db) return da - db;
        return (b.h || 0) - (a.h || 0);
    });
    return withHeights[0].f;
}

export function FormatPicker({
    availableFormats,
    audioFormats,
    value,
    onChange,
}: {
    availableFormats: BackendFormat[];
    audioFormats: BackendFormat[];
    value: DownloadPrefs;
    onChange: (next: DownloadPrefs) => void;
}) {
    const videoHeights = useMemo(() => {
        const hs = new Set<number>();
        for (const f of availableFormats) {
            const h = f.height;
            if (typeof h === "number" && h > 0) hs.add(h);
        }
        return Array.from(hs).sort((a, b) => b - a);
    }, [availableFormats]);

    const audioExts = useMemo(() => {
        const exts = new Set<string>();
        for (const f of audioFormats) exts.add(f.extension);
        return Array.from(exts);
    }, [audioFormats]);

    const mode = value.mode;

    const setMode = (m: "video" | "audio") => {
        if (m === "video") onChange({ ...value, mode: "video", container: value.container === "mp3" ? "mp4" : value.container, height: value.height || 1080 });
        else onChange({ ...value, mode: "audio", container: value.container === "webm" || value.container === "mp4" ? "mp3" : value.container, height: value.height || 1080 });
    };

    const setContainer = (c: DownloadPrefs["container"]) => onChange({ ...value, container: c });
    const setHeight = (h: number) => onChange({ ...value, height: h });

    const suggested = useMemo(() => {
        if (mode === "video") return pickClosestFormat(availableFormats, value.container, value.height);
        // audio: pick matching ext if possible
        const c = value.container === "mp3" ? "" : value.container;
        return pickClosestFormat(audioFormats, c, 0);
    }, [availableFormats, audioFormats, mode, value.container, value.height]);

    return (
        <div className="w-full space-y-3">
            <div className="flex p-1 bg-zinc-900 rounded-lg">
                <button
                    type="button"
                    onClick={() => setMode("video")}
                    className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${mode === "video" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
                >
                    Video
                </button>
                <button
                    type="button"
                    onClick={() => setMode("audio")}
                    className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${mode === "audio" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
                >
                    Audio
                </button>
            </div>

            {mode === "video" ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2 flex gap-2">
                        <button
                            type="button"
                            onClick={() => setContainer("mp4")}
                            className={`flex-1 h-10 rounded-lg border text-xs font-mono transition-all ${value.container === "mp4" ? "bg-white text-black border-transparent" : "bg-zinc-950/40 border-zinc-800 text-zinc-300 hover:bg-zinc-900"}`}
                        >
                            MP4
                        </button>
                        <button
                            type="button"
                            onClick={() => setContainer("webm")}
                            className={`flex-1 h-10 rounded-lg border text-xs font-mono transition-all ${value.container === "webm" ? "bg-white text-black border-transparent" : "bg-zinc-950/40 border-zinc-800 text-zinc-300 hover:bg-zinc-900"}`}
                        >
                            WEBM
                        </button>
                    </div>
                    <select
                        value={String(value.height)}
                        onChange={(e) => setHeight(Number(e.target.value))}
                        className="h-10 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 text-xs font-mono text-zinc-200 outline-none focus:border-zinc-600"
                    >
                        {[2160, 1440, 1080, 720, 480, 360, 240, 144]
                            .filter((h) => videoHeights.includes(h) || h === value.height)
                            .filter((h, idx, arr) => arr.indexOf(h) === idx)
                            .map((h) => (
                                <option key={h} value={h}>
                                    {h}p
                                </option>
                            ))}
                        {videoHeights
                            .filter((h) => ![2160, 1440, 1080, 720, 480, 360, 240, 144].includes(h))
                            .map((h) => (
                                <option key={h} value={h}>
                                    {h}p
                                </option>
                            ))}
                    </select>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setContainer("mp3")}
                        className={`h-10 rounded-lg border text-xs font-mono transition-all ${value.container === "mp3" ? "bg-white text-black border-transparent" : "bg-zinc-950/40 border-zinc-800 text-zinc-300 hover:bg-zinc-900"}`}
                    >
                        MP3
                    </button>
                    <button
                        type="button"
                        onClick={() => setContainer("m4a")}
                        className={`h-10 rounded-lg border text-xs font-mono transition-all ${value.container === "m4a" ? "bg-white text-black border-transparent" : "bg-zinc-950/40 border-zinc-800 text-zinc-300 hover:bg-zinc-900"}`}
                        disabled={audioExts.length > 0 && !audioExts.includes("m4a")}
                        title={audioExts.length > 0 && !audioExts.includes("m4a") ? "m4a not available (will fallback)" : ""}
                    >
                        M4A
                    </button>
                </div>
            )}

            <div className="text-[11px] text-zinc-500 font-mono">
                Suggested:{" "}
                <span className="text-zinc-300">
                    {suggested ? `${suggested.resolution} ${suggested.extension.toUpperCase()} • ${suggested.filesize_str}` : "Auto"}
                </span>
            </div>
        </div>
    );
}
