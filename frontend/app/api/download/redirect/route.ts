import { NextResponse } from 'next/server';
import { getSupabaseUserClient, getUserEnv, getUserIdFromBearer } from '@/app/api/_supabase/user';

export const dynamic = 'force-dynamic';

function isAllowedRedirectHost(hostname: string): boolean {
    const h = (hostname || '').toLowerCase();
    return (
        h === 'googlevideo.com' ||
        h.endsWith('.googlevideo.com') ||
        h.endsWith('.tiktokcdn.com') ||
        h.endsWith('.cdninstagram.com') ||
        h.endsWith('.fbcdn.net') ||
        h.endsWith('.facebook.com') ||
        h.endsWith('.x.com') ||
        h.endsWith('.twimg.com') ||
        h.endsWith('.ytimg.com')
    );
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
    if (!isAllowedRedirectHost(u.hostname)) {
        return NextResponse.json({ detail: 'Blocked host' }, { status: 400 });
    }

    // Note: We cannot safely stream large media via Vercel functions (timeouts).
    // Enforce quota here, then redirect the browser to the upstream URL.
    const { data: rpcData, error: rpcError } = await supabase.client.rpc('consume_download', { p_user_id: userId });
    if (rpcError) {
        return NextResponse.json({ detail: rpcError.message }, { status: 500 });
    }
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!row?.allowed) {
        return NextResponse.json({ detail: 'FREE limit reached' }, { status: 403 });
    }

    return NextResponse.redirect(u.toString(), { status: 302 });
}

