import { NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserIdFromBearer } from '@/app/api/_supabase/admin';

function effectivePlan(plan: string, ultimateUntil: string | null): 'free' | 'ultimate' {
    const p = (plan || '').toLowerCase();
    if (p !== 'ultimate') return 'free';
    if (!ultimateUntil) return 'ultimate';
    const t = Date.parse(ultimateUntil);
    if (Number.isNaN(t)) return 'free';
    return t > Date.now() ? 'ultimate' : 'free';
}

export async function POST(req: Request) {
    const admin = getSupabaseAdmin();
    if (!admin) {
        return NextResponse.json(
            { detail: 'Supabase is not configured on the server (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' },
            { status: 503 }
        );
    }

    const auth = req.headers.get('authorization') || '';
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
    const userId = await getUserIdFromBearer(admin.env, token);
    if (!userId) {
        return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { code?: string } | null;
    const code = (body?.code || '').trim();
    if (!code) {
        return NextResponse.json({ detail: 'Code is required' }, { status: 400 });
    }

    const { data: rpcData, error: rpcError } = await admin.client.rpc('redeem_promo_code', { p_user_id: userId, p_code: code });
    if (rpcError) {
        return NextResponse.json({ detail: rpcError.message }, { status: 500 });
    }
    const rpc = Array.isArray(rpcData) ? rpcData[0] : rpcData;

    // Fetch current profile after redeem
    const { data: profile, error: profileError } = await admin.client
        .from('user_profiles')
        .select('plan,downloads_used,ultimate_until')
        .eq('user_id', userId)
        .maybeSingle();
    if (profileError) {
        return NextResponse.json({ detail: profileError.message }, { status: 500 });
    }

    const plan = effectivePlan(String(profile?.plan || 'free'), (profile?.ultimate_until as string | null) || null);
    const downloadsUsed = Number(profile?.downloads_used || 0);
    const downloadsRemaining = plan === 'ultimate' ? null : Math.max(0, 5 - downloadsUsed);

    return NextResponse.json({
        success: Boolean(rpc?.success),
        message: (rpc?.message as string) || '',
        plan,
        ai_enabled: plan === 'ultimate',
        ultimate_until: (profile?.ultimate_until as string | null) || null,
        downloads_used: downloadsUsed,
        downloads_remaining: downloadsRemaining,
    });
}

