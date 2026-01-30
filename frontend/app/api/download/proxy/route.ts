import { NextResponse } from 'next/server';
import { getSupabaseUserClient, getUserEnv, getUserIdFromBearer } from '@/app/api/_supabase/user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const DEFAULT_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function isAllowedProxyHost(hostname: string): boolean {
    const h = (hostname || '').toLowerCase();

    // YouTube / Google
    if (h === 'googlevideo.com' || h.endsWith('.googlevideo.com')) return true;
    if (h.endsWith('.ytimg.com')) return true;
    if (h.endsWith('.youtube.com')) return true;
    if (h.endsWith('.ggpht.com')) return true;

    // TikTok
    if (h.endsWith('.tiktokcdn.com')) return true;
    if (h.endsWith('.tiktokcdn-us.com')) return true;
    if (h.endsWith('.byteoversea.com')) return true;
    if (h.endsWith('.muscdn.com')) return true;
    if (h.endsWith('.musical.ly')) return true;
    if (h.endsWith('.tiktokv.com')) return true;
    if (h.endsWith('.ibytedtos.com')) return true;

    // Instagram
    if (h.endsWith('.cdninstagram.com')) return true;
    if (h.endsWith('.instagram.com')) return true;

    // Facebook
    if (h.endsWith('.fbcdn.net')) return true;
    if (h.endsWith('.facebook.com')) return true;
    if (h.endsWith('.fbsbx.com')) return true;
    if (h.endsWith('.akamaihd.net')) return true;

    // Twitter / X
    if (h.endsWith('.x.com')) return true;
    if (h.endsWith('.twimg.com')) return true;
    if (h.endsWith('.twitter.com')) return true;
    if (h.endsWith('.video.twimg.com')) return true;

    // Snapchat
    if (h.endsWith('.snap.com')) return true;
    if (h.endsWith('.snapchat.com')) return true;
    if (h.endsWith('.sc-cdn.net')) return true;

    // Pinterest
    if (h.endsWith('.pinimg.com')) return true;

    // Vimeo
    if (h.endsWith('.vimeo.com')) return true;
    if (h.endsWith('.vimeocdn.com')) return true;

    // Reddit
    if (h.endsWith('.redd.it')) return true;
    if (h.endsWith('.redditmedia.com')) return true;

    // Third-party download services
    if (h.endsWith('.phimtatvn.com')) return true;
    if (h.endsWith('.savefrom.net')) return true;
    if (h.endsWith('.y2mate.com')) return true;

    // Generic CDNs often used
    if (h.endsWith('.cloudfront.net')) return true;
    if (h.endsWith('.fastly.net')) return true;

    return false;
}

function safeFilename(name: string, fallbackExt: string): string {
    const base = (name || '').trim() || 'downvid';
    const cleaned = base
        .replace(/[\\/:*?"<>|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
    const hasExt = /\.[a-z0-9]{2,5}$/i.test(cleaned);
    return hasExt ? cleaned : `${cleaned}.${fallbackExt || 'mp4'}`;
}

export async function POST(req: Request) {
    const env = getUserEnv();
    if (!env) {
        const hasUrl = Boolean((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim());
        const hasAnon = Boolean((process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim());
        return NextResponse.json(
            {
                detail: 'Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)',
                missing: { NEXT_PUBLIC_SUPABASE_URL: !hasUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: !hasAnon },
            },
            { status: 503 }
        );
    }

    const form = await req.formData().catch(() => null);
    const urlRaw = (form?.get('url') || '').toString().trim();
    const nameRaw = (form?.get('filename') || '').toString().trim();
    const tokenField = (form?.get('access_token') || '').toString().trim();

    const auth = req.headers.get('authorization') || '';
    const headerToken = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
    const token = headerToken || tokenField;
    const userId = await getUserIdFromBearer(env, token);
    if (!userId) {
        return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }
    const supabase = getSupabaseUserClient(token);
    if (!supabase) {
        return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    if (!urlRaw) return NextResponse.json({ detail: 'url is required' }, { status: 400 });

    let u: URL;
    try {
        u = new URL(urlRaw);
    } catch {
        return NextResponse.json({ detail: 'Invalid url' }, { status: 400 });
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
        return NextResponse.json({ detail: 'Invalid url protocol' }, { status: 400 });
    }
    if (!isAllowedProxyHost(u.hostname)) {
        return NextResponse.json({ detail: 'Blocked host' }, { status: 400 });
    }

    // Stream remote bytes.
    const range = req.headers.get('range') || undefined;

    const isGoogleVideo = u.hostname === 'googlevideo.com' || u.hostname.endsWith('.googlevideo.com');

    async function fetchUpstream(extraHeaders?: Record<string, string>) {
        const headers: Record<string, string> = {
            ...(range ? { Range: range } : {}),
            'User-Agent': DEFAULT_UA,
            Accept: '*/*',
            ...(isGoogleVideo ? { Referer: 'https://www.youtube.com/', Origin: 'https://www.youtube.com' } : {}),
            ...(extraHeaders || {}),
        };
        return await fetch(u.toString(), { method: 'GET', headers, redirect: 'follow' }).catch(() => null);
    }

    let upstream = await fetchUpstream();
    // Some CDNs are picky; retry once with Range if first attempt is blocked.
    if (upstream && !upstream.ok && upstream.status !== 206) {
        const shouldRetry = [400, 403, 410, 429].includes(upstream.status) && !range;
        if (shouldRetry) {
            try {
                await upstream.body?.cancel();
            } catch {
                // ignore
            }
            upstream = await fetchUpstream({ Range: 'bytes=0-' });
        }
    }

    if (!upstream) {
        return NextResponse.json({ detail: 'Upstream fetch failed' }, { status: 502 });
    }
    if (!upstream.ok && upstream.status !== 206) {
        const text = await upstream.text().catch(() => '');
        return NextResponse.json(
            { detail: `Upstream error (${upstream.status})`, host: u.hostname, raw: text.slice(0, 200) },
            { status: 502 }
        );
    }

    // Consume quota (FREE only) *after* verifying upstream is reachable, to avoid charging users on failed downloads.
    const { data: rpcData, error: rpcError } = await supabase.client.rpc('consume_download', { p_user_id: userId });
    if (rpcError) {
        try {
            await upstream.body?.cancel();
        } catch {
            // ignore
        }
        return NextResponse.json({ detail: rpcError.message }, { status: 500 });
    }
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!row?.allowed) {
        try {
            await upstream.body?.cancel();
        } catch {
            // ignore
        }
        return NextResponse.json({ detail: 'FREE limit reached' }, { status: 403 });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');
    const extGuess = contentType.includes('audio') ? 'm4a' : 'mp4';
    const filename = safeFilename(nameRaw, extGuess);

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Accept-Ranges', 'bytes');
    if (contentLength) headers.set('Content-Length', contentLength);
    if (contentRange) headers.set('Content-Range', contentRange);

    return new Response(upstream.body, { status: upstream.status, headers });
}
