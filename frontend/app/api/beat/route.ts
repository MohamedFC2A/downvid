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

type BeatRequest = { url?: string };

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

    // Ensure profile exists
    await admin.client.from('user_profiles').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
    const { data: profile, error: profileError } = await admin.client
        .from('user_profiles')
        .select('plan,ultimate_until')
        .eq('user_id', userId)
        .maybeSingle();
    if (profileError) {
        return NextResponse.json({ detail: profileError.message }, { status: 500 });
    }

    const plan = effectivePlan(String(profile?.plan || 'free'), (profile?.ultimate_until as string | null) || null);
    if (plan !== 'ultimate') {
        return NextResponse.json({ detail: 'Ultimate subscription required' }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as BeatRequest | null;
    const url = (body?.url || '').trim();
    if (!/^https?:\/\/\S+/i.test(url)) {
        return NextResponse.json({ detail: 'URL is required' }, { status: 400 });
    }

    const langParam = new URL(req.url).searchParams.get('lang') || 'ar';
    const lang = (langParam || 'ar').trim().toLowerCase().startsWith('ar') ? 'ar' : 'en';

    const apiKey = (process.env.DEEPSEEK_API_KEY || '').trim();
    if (!apiKey) {
        // Fallback output (still valid BEAT pack)
        return NextResponse.json({
            title: 'Video',
            duration_seconds: 180,
            beats: [
                { start_sec: 0, end_sec: 15, label: 'Hook', goal: 'Hook', caption: 'Start with the payoff.' },
                { start_sec: 15, end_sec: 60, label: 'Context', goal: 'Context', caption: 'Set the scene fast.' },
                { start_sec: 60, end_sec: 140, label: 'Value', goal: 'Proof', caption: 'Deliver the core value.' },
                { start_sec: 140, end_sec: 180, label: 'CTA', goal: 'Payoff', caption: 'One clear call to action.' },
            ],
            shorts: [
                { start_sec: 0, end_sec: 30, title: 'Short #1', hook: 'Best moment first.' },
            ],
            exports: {
                youtube_chapters: '00:00 Hook\n00:15 Context\n01:00 Value\n02:20 CTA\n',
                markers_csv: 'time_sec,label,comment\n0,Hook,Start with payoff\n15,Context,Set context\n60,Value,Deliver value\n140,CTA,Call to action\n',
            },
            notes: 'Missing DEEPSEEK_API_KEY on Vercel',
        });
    }

    const outLang = lang === 'ar' ? 'Arabic' : 'English';
    const prompt = `
You are a creator workflow assistant.

Task: produce a BEAT pack for editing & publishing from a URL.
Output language: ${outLang}.

URL: ${url}

Return STRICT JSON with keys:
- title: string
- duration_seconds: number|null
- beats: array of 8-16 objects, each:
  - start_sec: number (>=0)
  - end_sec: number (> start_sec)
  - label: short label
  - goal: short purpose (hook/proof/payoff/etc)
  - caption: 1 short line to overlay or say
- shorts: array of 3-7 objects:
  - start_sec: number (>=0)
  - end_sec: number (> start_sec)
  - title: short title
  - hook: 1 line hook
- exports:
  - youtube_chapters: string with lines like "00:00 Intro"
  - markers_csv: CSV string with header "time_sec,label,comment" and 8-16 rows

Rules:
- If duration_seconds is null, assume 180 seconds for timing.
- Ensure all times are within the duration.
- Keep beats ordered by time with no overlaps.
`;

    const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: 'You are a strict JSON generator. Output JSON only.' },
                { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
        }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        return NextResponse.json({ detail: `DeepSeek error (${res.status})`, raw: text.slice(0, 500) }, { status: 502 });
    }
    const json = (await res.json().catch(() => null)) as
        | { choices?: Array<{ message?: { content?: unknown } }> }
        | null;
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
        return NextResponse.json({ detail: 'Invalid AI response' }, { status: 502 });
    }
    try {
        const parsed = JSON.parse(content) as unknown;
        return NextResponse.json(parsed);
    } catch {
        return NextResponse.json({ detail: 'Invalid AI response' }, { status: 502 });
    }
}
