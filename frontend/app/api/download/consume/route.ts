import { NextResponse } from 'next/server';
import { getSupabaseUserClient, getUserEnv, getUserIdFromBearer } from '@/app/api/_supabase/user';

export const dynamic = 'force-dynamic';

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

    const auth = req.headers.get('authorization') || '';
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
    const userId = await getUserIdFromBearer(env, token);
    if (!userId) {
        return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseUserClient(token);
    if (!supabase) {
        return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    const { data: rpcData, error: rpcError } = await supabase.client.rpc('consume_download', { p_user_id: userId });
    if (rpcError) {
        return NextResponse.json({ detail: rpcError.message }, { status: 500 });
    }
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;

    return NextResponse.json({
        allowed: Boolean(row?.allowed),
        plan: typeof row?.plan === 'string' ? row.plan : 'free',
        downloads_used: typeof row?.downloads_used === 'number' ? row.downloads_used : null,
        downloads_remaining: typeof row?.downloads_remaining === 'number' ? row.downloads_remaining : null,
    });
}

