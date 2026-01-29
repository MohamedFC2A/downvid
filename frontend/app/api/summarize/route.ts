import { NextResponse } from 'next/server';
import { getSupabaseUserClient, getUserEnv, getUserIdFromBearer } from '@/app/api/_supabase/user';

export const dynamic = 'force-dynamic';

type AnyRecord = Record<string, unknown>;

function asRecord(v: unknown): AnyRecord | null {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as AnyRecord) : null;
}

function effectivePlan(plan: string, ultimateUntil: string | null): 'free' | 'ultimate' {
    const p = (plan || '').toLowerCase();
    if (p !== 'ultimate') return 'free';
    if (!ultimateUntil) return 'ultimate';
    const t = Date.parse(ultimateUntil);
    if (Number.isNaN(t)) return 'free';
    return t > Date.now() ? 'ultimate' : 'free';
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

    await supabase.client.from('user_profiles').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
    const { data: profile, error: profileError } = await supabase.client
        .from('user_profiles')
        .select('plan,ultimate_until')
        .eq('user_id', userId)
        .maybeSingle();
    if (profileError) {
        return NextResponse.json({ detail: profileError.message }, { status: 500 });
    }

    const plan = effectivePlan(String((profile as AnyRecord | null)?.plan || 'free'), (profile as AnyRecord | null)?.ultimate_until as string | null);
    if (plan !== 'ultimate') {
        return NextResponse.json({ detail: 'Ultimate subscription required' }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { url?: string } | null;
    const url = (body?.url || '').trim();
    if (!/^https?:\/\/\S+/i.test(url)) {
        return NextResponse.json({ detail: 'URL is required' }, { status: 400 });
    }

    const rapidKey = (process.env.RAPIDAPI_KEY || '').trim();
    const rapidHost = (process.env.RAPIDAPI_HOST || 'social-download-all-in-one.p.rapidapi.com').trim();
    const deepseekKey = (process.env.DEEPSEEK_API_KEY || '').trim();

    // Best-effort metadata only (no transcript in Vercel-only mode).
    let title = 'Video';
    let description = '';
    if (rapidKey && rapidHost) {
        try {
            const res = await fetch('https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink', {
                method: 'POST',
                headers: { 'x-rapidapi-key': rapidKey, 'x-rapidapi-host': rapidHost, 'content-type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            if (res.ok) {
                const j = (await res.json().catch(() => null)) as AnyRecord | null;
                if (j) {
                    title = String(j.title || j.name || title);
                    description = typeof j.description === 'string' ? j.description : description;
                }
            }
        } catch {
            // ignore
        }
    }

    const langParam = new URL(req.url).searchParams.get('lang') || 'ar';
    const outLang = langParam.trim().toLowerCase().startsWith('ar') ? 'ar' : 'en';
    if (!deepseekKey) {
        return NextResponse.json({
            title,
            source: 'metadata_fallback',
            has_transcript: false,
            summary: [],
            key_moments: [],
            takeaways: [],
            hashtags: [],
            topics: [],
            notes: 'Missing DEEPSEEK_API_KEY',
        });
    }

    const languageLabel = outLang === 'ar' ? 'Arabic' : 'English';
    const prompt = `
Return STRICT JSON only.

Language: ${languageLabel}
Input:
- title: ${title}
- description: ${description}

JSON schema:
{
  "source": "metadata_fallback",
  "summary": ["..."],
  "key_moments": ["..."],
  "takeaways": ["..."],
  "hashtags": ["#..."],
  "topics": ["..."]
}
Rules:
- summary: 5-9 bullets.
- key_moments: 5-9 bullets.
- takeaways: 4-7 bullets.
- hashtags: 8-14 items.
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
    if (!res.ok) {
        return NextResponse.json({ detail: `DeepSeek error (${res.status})` }, { status: 502 });
    }
    const j = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: unknown } }> } | null;
    const content = j?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
        return NextResponse.json({ detail: 'Invalid AI response' }, { status: 502 });
    }
    const parsed = JSON.parse(content) as unknown;
    const obj = asRecord(parsed) || {};

    return NextResponse.json({
        title,
        source: 'metadata_fallback',
        has_transcript: false,
        summary: Array.isArray(obj.summary) ? obj.summary.slice(0, 12) : [],
        key_moments: Array.isArray(obj.key_moments) ? obj.key_moments.slice(0, 12) : [],
        takeaways: Array.isArray(obj.takeaways) ? obj.takeaways.slice(0, 12) : [],
        hashtags: Array.isArray(obj.hashtags) ? obj.hashtags.slice(0, 20) : [],
        topics: Array.isArray(obj.topics) ? obj.topics.slice(0, 20) : [],
        notes: '',
    });
}

