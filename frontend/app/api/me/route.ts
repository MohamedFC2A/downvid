import { NextResponse } from 'next/server';
import { getSupabaseUserClient, getUserEnv, getUserIdFromBearer } from '@/app/api/_supabase/user';

export const dynamic = 'force-dynamic';

function effectivePlan(plan: string, ultimateUntil: string | null): 'free' | 'ultimate' {
    const p = (plan || '').toLowerCase();
    if (p !== 'ultimate') return 'free';
    if (!ultimateUntil) return 'ultimate';
    const t = Date.parse(ultimateUntil);
    if (Number.isNaN(t)) return 'free';
    return t > Date.now() ? 'ultimate' : 'free';
}

export async function GET(req: Request) {
    const env = getUserEnv();
    if (!env) {
        const hasUrl = Boolean((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim());
        const hasAnon = Boolean((process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim());
        return NextResponse.json(
            {
                supabase_enabled: false,
                plan: 'free',
                downloads_used: 0,
                downloads_remaining: 5,
                ai_enabled: false,
                ultimate_until: null,
                missing: {
                    NEXT_PUBLIC_SUPABASE_URL: !hasUrl,
                    NEXT_PUBLIC_SUPABASE_ANON_KEY: !hasAnon,
                },
            },
            { status: 200 }
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

    // Ensure profile exists
    await supabase.client.from('user_profiles').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });

    const { data, error } = await supabase.client
        .from('user_profiles')
        .select('user_id,plan,downloads_used,ultimate_until')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        return NextResponse.json({ detail: error.message }, { status: 500 });
    }

    const plan = effectivePlan(String(data?.plan || 'free'), (data?.ultimate_until as string | null) || null);
    const downloadsUsed = Number(data?.downloads_used || 0);
    const downloadsRemaining = plan === 'ultimate' ? null : Math.max(0, 5 - downloadsUsed);

    return NextResponse.json({
        supabase_enabled: true,
        user_id: userId,
        plan,
        downloads_used: downloadsUsed,
        downloads_remaining: downloadsRemaining,
        ai_enabled: plan === 'ultimate',
        ultimate_until: (data?.ultimate_until as string | null) || null,
    });
}
