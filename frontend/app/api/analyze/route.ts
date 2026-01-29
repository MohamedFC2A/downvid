import { NextResponse } from 'next/server';
import { getSupabaseUserClient, getUserEnv, getUserIdFromBearer } from '@/app/api/_supabase/user';

export const dynamic = 'force-dynamic';

type AnyRecord = Record<string, unknown>;

function asRecord(v: unknown): AnyRecord | null {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as AnyRecord) : null;
}

function parseBytesFromString(s: string): number | null {
    const raw = (s || '').trim();
    if (!raw) return null;
    const m = raw.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
    if (!m) return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    const unit = m[2].toUpperCase();
    const pow = unit === 'B' ? 0 : unit === 'KB' ? 1 : unit === 'MB' ? 2 : unit === 'GB' ? 3 : 4;
    return Math.floor(n * Math.pow(1024, pow));
}

function formatBytes(n: unknown): string {
    if (typeof n === 'string' && n.trim()) return n.trim();
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return 'Unknown';
    let b = n;
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let idx = 0;
    while (b >= 1024 && idx < units.length - 1) {
        b /= 1024;
        idx += 1;
    }
    return `${b.toFixed(1)}${units[idx]}`;
}

function parseHeight(resolution: string): number | undefined {
    const s = (resolution || '').toLowerCase();
    if (s.includes('8k')) return 4320;
    if (s.includes('4k')) return 2160;
    const m2 = s.match(/\b(\d{3,4})\s*[x×]\s*(\d{3,4})\b/);
    if (m2) {
        const h = Number.parseInt(m2[2], 10);
        return Number.isFinite(h) ? h : undefined;
    }
    const m = s.match(/(\d{3,4})p/);
    if (m) {
        const v = Number.parseInt(m[1], 10);
        return Number.isFinite(v) ? v : undefined;
    }
    return undefined;
}

function parseNumberMaybe(v: unknown): number | undefined {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
        const n = Number.parseFloat(v.trim());
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}

function detectAudio(fmt: AnyRecord): boolean {
    const t = String(fmt.type || fmt.mime || '').toLowerCase();
    const ext = String(fmt.extension || fmt.ext || '').toLowerCase().replace(/^\./, '');
    if (t.includes('audio')) return true;
    if (['mp3', 'm4a', 'aac', 'wav', 'flac', 'opus', 'ogg'].includes(ext)) return true;
    const vcodec = String(fmt.vcodec || fmt.videoCodec || '').toLowerCase();
    const acodec = String(fmt.acodec || fmt.audioCodec || '').toLowerCase();
    if ((vcodec === 'none' || vcodec === '') && acodec && acodec !== 'none') return true;
    return false;
}

function collectFormats(data: AnyRecord): AnyRecord[] {
    const d1 = asRecord(data.data) || {};
    const candidates = [
        data.medias,
        data.formats,
        data.links,
        data.videos,
        data.downloads,
        d1.medias,
        d1.formats,
    ];
    for (const c of candidates) {
        if (Array.isArray(c) && c.length) {
            return c.filter((x) => asRecord(x)).map((x) => x as AnyRecord);
        }
    }
    return [];
}

function extractAnyLinks(obj: unknown): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    function walk(x: unknown) {
        if (!x) return;
        if (Array.isArray(x)) {
            for (const it of x) walk(it);
            return;
        }
        if (typeof x === 'object') {
            const r = x as AnyRecord;
            for (const k of Object.keys(r)) walk(r[k]);
            return;
        }
        if (typeof x === 'string') {
            if (x.startsWith('http') && (x.includes('.mp4') || x.includes('.m4a') || x.includes('video'))) {
                if (!seen.has(x)) {
                    seen.add(x);
                    out.push(x);
                }
            }
        }
    }
    walk(obj);
    return out;
}

function effectivePlan(plan: string, ultimateUntil: string | null): 'free' | 'ultimate' {
    const p = (plan || '').toLowerCase();
    if (p !== 'ultimate') return 'free';
    if (!ultimateUntil) return 'ultimate';
    const t = Date.parse(ultimateUntil);
    if (Number.isNaN(t)) return 'free';
    return t > Date.now() ? 'ultimate' : 'free';
}

async function fetchRemoteSizeBytes(url: string, timeoutMs = 2500): Promise<number | null> {
    const u = (url || '').trim();
    if (!/^https?:\/\//i.test(u)) return null;

    async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), timeoutMs);
        try {
            return await fn(ac.signal);
        } finally {
            clearTimeout(t);
        }
    }

    // 1) Try HEAD content-length
    const head = await withTimeout(async (signal) => {
        try {
            return await fetch(u, { method: 'HEAD', redirect: 'follow', signal });
        } catch {
            return null;
        }
    });
    if (head && (head.ok || head.status === 206)) {
        const len = head.headers.get('content-length');
        const n = len ? Number(len) : NaN;
        if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }

    // 2) Fallback: Range request, parse content-range total bytes (bytes 0-0/12345)
    const ranged = await withTimeout(async (signal) => {
        try {
            return await fetch(u, { method: 'GET', headers: { Range: 'bytes=0-0' }, redirect: 'follow', signal });
        } catch {
            return null;
        }
    });
    if (ranged && (ranged.ok || ranged.status === 206)) {
        const cr = ranged.headers.get('content-range') || '';
        const m = cr.match(/\/(\d+)\s*$/);
        if (m) {
            const n = Number(m[1]);
            if (Number.isFinite(n) && n > 0) return Math.floor(n);
        }
        const len = ranged.headers.get('content-length');
        const n = len ? Number(len) : NaN;
        if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }

    return null;
}

export async function POST(req: Request) {
    const body = (await req.json().catch(() => null)) as { url?: string } | null;
    const url = (body?.url || '').trim();
    if (!/^https?:\/\/\S+/i.test(url)) {
        return NextResponse.json({ detail: 'URL is required' }, { status: 400 });
    }

    const rapidKey = (process.env.RAPIDAPI_KEY || '').trim();
    const rapidHost = (process.env.RAPIDAPI_HOST || 'social-download-all-in-one.p.rapidapi.com').trim();
    const snapHost = (process.env.RAPIDAPI_SNAP_HOST || 'snap-video3.p.rapidapi.com').trim();
    if (!rapidKey || !rapidHost) {
        return NextResponse.json({ detail: 'RapidAPI is not configured (RAPIDAPI_KEY / RAPIDAPI_HOST)' }, { status: 503 });
    }

    async function autolink(): Promise<AnyRecord> {
        const res = await fetch('https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink', {
            method: 'POST',
            headers: {
                'x-rapidapi-key': rapidKey,
                'x-rapidapi-host': rapidHost,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ url }),
        });
        if (!res.ok) throw new Error(`RapidAPI autolink failed (${res.status})`);
        return (await res.json()) as AnyRecord;
    }

    async function snapDownload(): Promise<AnyRecord> {
        const form = new URLSearchParams();
        form.set('url', url);
        const res = await fetch('https://snap-video3.p.rapidapi.com/download', {
            method: 'POST',
            headers: {
                'x-rapidapi-key': rapidKey,
                'x-rapidapi-host': snapHost,
                'content-type': 'application/x-www-form-urlencoded',
            },
            body: form.toString(),
        });
        if (!res.ok) throw new Error(`RapidAPI snap-video3 failed (${res.status})`);
        return (await res.json()) as AnyRecord;
    }

    let data: AnyRecord | null = null;
    try {
        data = await autolink();
    } catch {
        try {
            data = await snapDownload();
        } catch (e2) {
            return NextResponse.json({ detail: e2 instanceof Error ? e2.message : 'RapidAPI failed' }, { status: 502 });
        }
    }

    const title = String(data.title || data.name || 'Video');
    const thumbnail = String(data.thumbnail || data.thumb || data.image || '');
    const description = typeof data.description === 'string' ? data.description : null;

    const formats = collectFormats(data);
    const video: Array<{
        format_id: string;
        resolution: string;
        extension: string;
        filesize_str: string;
        note: string;
        height?: number;
        fps?: number;
        abr?: number;
        vcodec?: string;
        acodec?: string;
        url?: string;
    }> = [];
    const audio: typeof video = [];

    const directLinks = formats.length ? null : extractAnyLinks(data);
    if (directLinks && directLinks.length > 0) {
        video.push({
            format_id: 'standard',
            resolution: 'Standard',
            extension: 'mp4',
            filesize_str: 'Unknown',
            note: 'snap-video3',
            url: directLinks[0],
        });
    } else {
        for (let i = 0; i < formats.length; i++) {
            const f = formats[i];
            const link = String(f.url || f.link || f.downloadUrl || f.download_url || '');
            if (!link) continue;

            const ext = String(f.extension || f.ext || f.container || 'mp4').replace(/^\./, '') || 'mp4';
            const isAudio = detectAudio(f);
            const qualityRaw = String(f.quality || f.resolution || f.qualityLabel || f.label || f.format || f.name || '');
            const height = typeof f.height === 'number' && Number.isFinite(f.height) ? Math.floor(f.height) : parseHeight(qualityRaw);
            const resolution = isAudio ? 'Audio' : height ? `${height}p` : qualityRaw || 'Standard';
            const note = String(f.note || f.format_note || f.type || '').trim();
            const fpsRaw = parseNumberMaybe(f.fps ?? f.frameRate ?? f.framerate ?? f.frame_rate);
            const fps = typeof fpsRaw === 'number' && Number.isFinite(fpsRaw) && fpsRaw > 0 ? fpsRaw : undefined;

            let abr: number | undefined;
            if (isAudio) {
                const abrRaw = parseNumberMaybe(f.abr ?? f.audioBitrate ?? f.audio_bitrate ?? f.bitrate ?? f.kbps);
                if (typeof abrRaw === 'number' && abrRaw > 0) {
                    abr = abrRaw > 1000 ? abrRaw / 1000 : abrRaw;
                }
            }
            const vcodec = typeof f.vcodec === 'string' ? f.vcodec : typeof f.videoCodec === 'string' ? f.videoCodec : undefined;
            const acodec = typeof f.acodec === 'string' ? f.acodec : typeof f.audioCodec === 'string' ? f.audioCodec : undefined;
            const fmtId = String(f.format_id || f.id || f.itag || `${ext}-${i}`);
            const filesizeStr = formatBytes(f.formattedSize ?? f.size ?? f.filesize ?? f.fileSize ?? f.filesize_approx ?? f.contentLength);

            const out = {
                format_id: fmtId,
                resolution,
                extension: ext,
                filesize_str: filesizeStr,
                note,
                height,
                fps,
                abr,
                vcodec,
                acodec,
                url: link,
            };
            (isAudio ? audio : video).push(out);
        }
    }

    video.sort((a, b) => (b.height || 0) - (a.height || 0));
    audio.sort((a, b) => (b.abr || 0) - (a.abr || 0));

    // Best-effort: fill missing sizes for a small subset to improve UX without slowing too much.
    async function fillMissingSizes(list: Array<{ filesize_str: string; url?: string }>, limit: number) {
        const targets = list
            .slice(0, limit)
            .map((it, idx) => ({ it, idx }))
            .filter(({ it }) => Boolean(it.url) && (!it.filesize_str || it.filesize_str === 'Unknown' || parseBytesFromString(it.filesize_str) === null));

        const concurrency = 4;
        let cursor = 0;
        async function worker() {
            while (cursor < targets.length) {
                const idx = cursor++;
                const it = targets[idx]?.it;
                if (!it?.url) continue;
                const size = await fetchRemoteSizeBytes(it.url);
                if (typeof size === 'number' && size > 0) {
                    it.filesize_str = formatBytes(size);
                }
            }
        }
        await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()));
    }

    await Promise.all([fillMissingSizes(video, 10), fillMissingSizes(audio, 8)]);

    // Optional AI analysis (best-effort; never blocks downloads).
    const aiParam = new URL(req.url).searchParams.get('ai') || 'true';
    const aiRequested = aiParam === 'true' || aiParam === '1' || aiParam === 'yes';
    const langParam = new URL(req.url).searchParams.get('lang') || 'ar';
    const outLang = langParam.trim().toLowerCase().startsWith('ar') ? 'ar' : 'en';
    const deepseekKey = (process.env.DEEPSEEK_API_KEY || '').trim();

    let analysis: AnyRecord | null = null;
    if (aiRequested && deepseekKey) {
        const env = getUserEnv();
        const auth = req.headers.get('authorization') || '';
        const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
        const userId = env ? await getUserIdFromBearer(env, token) : null;
        const supabase = userId ? getSupabaseUserClient(token) : null;

        let canUseAi = false;
        if (supabase && userId) {
            await supabase.client.from('user_profiles').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
            const { data: profile } = await supabase.client
                .from('user_profiles')
                .select('plan,ultimate_until')
                .eq('user_id', userId)
                .maybeSingle();
            const plan = effectivePlan(String((profile as AnyRecord | null)?.plan || 'free'), (profile as AnyRecord | null)?.ultimate_until as string | null);
            canUseAi = plan === 'ultimate';
        }

        if (canUseAi) {
            const languageLabel = outLang === 'ar' ? 'Arabic' : 'English';
            const prompt = `
Return STRICT JSON only.

Language: ${languageLabel}

Video:
- title: ${title}
- description: ${description || ''}

JSON schema:
{
  "summary": ["..."],
  "sentiment": "Positive|Neutral|Negative",
  "topics": ["..."],
  "keywords": ["..."],
  "hashtags": ["#..."],
  "hook": "..."
}
Rules:
- summary: 4-7 short bullet points.
- hashtags: 8-14 items, include #.
`;
            const res = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${deepseekKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: 'You are a strict JSON generator. Output JSON only.' },
                        { role: 'user', content: prompt },
                    ],
                    response_format: { type: 'json_object' },
                }),
            });
            if (res.ok) {
                const j = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: unknown } }> } | null;
                const content = j?.choices?.[0]?.message?.content;
                if (typeof content === 'string') {
                    try {
                        analysis = (JSON.parse(content) as AnyRecord) || null;
                    } catch {
                        // Some models occasionally return non-strict JSON even with response_format.
                        // Ignore analysis rather than failing the entire request.
                        analysis = null;
                    }
                } else {
                    analysis = asRecord(content) || null;
                }
            }
        }
    }

    return NextResponse.json({
        title,
        thumbnail: thumbnail || undefined,
        description: description || undefined,
        analysis,
        available_formats: video,
        audio_formats: audio,
    });
}
