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

export async function POST(req: Request) {
    const env = getUserEnv();
    if (!env) {
        const hasUrl = Boolean((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim());
        const hasAnon = Boolean((process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim());
        return NextResponse.json(
            {
                detail: 'Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)',
                missing: {
                    NEXT_PUBLIC_SUPABASE_URL: !hasUrl,
                    NEXT_PUBLIC_SUPABASE_ANON_KEY: !hasAnon,
                },
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

    // Ensure profile exists
    await supabase.client.from('user_profiles').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
    const { data: profile, error: profileError } = await supabase.client
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

    const body = (await req.json().catch(() => null)) as
        | {
              url?: string;
              title?: string;
              description?: string;
              duration_seconds?: number;
              transcript_text?: string;
              vision_shots?: Array<{
                  start_sec?: number;
                  end_sec?: number;
                  energy_score?: number;
                  energy_label?: string;
                  note?: string;
                  confidence?: number;
              }>;
          }
        | null;
    const url = (body?.url || '').trim();
    const title = (body?.title || '').trim();
    const description = (body?.description || '').trim();
    const transcriptText = (body?.transcript_text || '').trim();
    const durationSeconds = typeof body?.duration_seconds === 'number' && Number.isFinite(body.duration_seconds) ? Math.floor(body.duration_seconds) : null;

    const visionShots = Array.isArray(body?.vision_shots) ? body!.vision_shots!.slice(0, 24) : [];

    const hasUrl = /^https?:\/\/\S+/i.test(url);
    if (!hasUrl && !title && !description) {
        return NextResponse.json({ detail: 'Provide url or title/description' }, { status: 400 });
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
                shotlist_md: '- **00:00–00:15** — Hook (Hook)\n- **00:15–01:00** — Context (Context)\n- **01:00–02:20** — Value (Proof)\n- **02:20–03:00** — CTA (Payoff)\n',
                broll_prompts: '- B-roll for: Hook\n- B-roll for: Context\n- B-roll for: Value\n- B-roll for: CTA\n',
            },
            notes: 'Missing DEEPSEEK_API_KEY on Vercel',
        });
    }

    const outLang = lang === 'ar' ? 'Arabic' : 'English';
    const visionBlock = visionShots.length
        ? `
Vision shots (auto-detected from uploaded clip):
${visionShots
    .map((s) => {
        const start = typeof s.start_sec === 'number' && Number.isFinite(s.start_sec) ? Math.max(0, Math.floor(s.start_sec)) : 0;
        const end = typeof s.end_sec === 'number' && Number.isFinite(s.end_sec) ? Math.max(start + 1, Math.floor(s.end_sec)) : start + 1;
        const energy = typeof s.energy_score === 'number' && Number.isFinite(s.energy_score) ? Math.round(Math.max(0, Math.min(1, s.energy_score)) * 100) : 0;
        const lbl = typeof s.energy_label === 'string' ? s.energy_label : '';
        const note = typeof s.note === 'string' ? s.note : '';
        const conf = typeof s.confidence === 'number' && Number.isFinite(s.confidence) ? Math.round(Math.max(0, Math.min(1, s.confidence)) * 100) : 0;
        return `- ${start}s–${end}s | energy ${energy}% (${lbl}) | confidence ${conf}% | ${note}`;
    })
    .join('\n')}
`
        : '';
    const prompt = `
You are a creator workflow assistant.

Task: produce a BEAT pack for editing & publishing.
Output language: ${outLang}.

Input:
- URL: ${hasUrl ? url : 'N/A'}
- Title: ${title || 'N/A'}
- Description: ${description || 'N/A'}
- Duration seconds: ${durationSeconds ?? 'N/A'}
- Transcript (may be empty):
${transcriptText ? transcriptText.slice(0, 12000) : ''}
${visionBlock}

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
- pacing: object (optional but recommended if Vision shots provided):
  - highlights: array of up to 8 objects: { start_sec,end_sec, why }
  - boring_parts: array of up to 8 objects: { start_sec,end_sec, why, fix }
- exports:
  - youtube_chapters: string with lines like "00:00 Intro"
  - markers_csv: CSV string with header "time_sec,label,comment" and 8-16 rows
  - shotlist_md: markdown string listing beats with time ranges and goals
  - broll_prompts: string with 8-14 bullet prompts for b-roll shots

Rules:
- If duration_seconds is null, assume 180 seconds for timing.
- Ensure all times are within the duration.
- Keep beats ordered by time with no overlaps.
- If Vision shots are provided, prefer aligning beats to those boundaries and respect the energy labels.
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
    function fmtTime(sec: number): string {
        const s = Math.max(0, Math.floor(sec));
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
    }

    type Beat = { start_sec: number; end_sec: number; label: string; goal?: string; caption?: string };
    type BeatPack = {
        title?: unknown;
        duration_seconds?: unknown;
        beats?: unknown;
        shorts?: unknown;
        exports?: unknown;
        pacing?: unknown;
    };

    function asRecord(v: unknown): Record<string, unknown> | null {
        return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    }

    function clampPack(input: unknown): {
        title: string;
        duration_seconds: number;
        beats: Beat[];
        shorts: Array<{ start_sec: number; end_sec: number; title: string; hook: string }>;
        pacing?: { highlights: Array<{ start_sec: number; end_sec: number; why: string }>; boring_parts: Array<{ start_sec: number; end_sec: number; why: string; fix: string }> };
        exports: { youtube_chapters: string; markers_csv: string; shotlist_md: string; broll_prompts: string };
    } {
        const obj = (asRecord(input) as BeatPack | null) || {};
        const rawDuration = obj.duration_seconds;
        const dur =
            typeof rawDuration === 'number' && rawDuration > 0
                ? Math.floor(rawDuration)
                : durationSeconds ?? 180;

        const rawBeats = Array.isArray(obj.beats) ? (obj.beats as unknown[]) : [];
        const denom = Math.max(1, rawBeats.length);
        const cleanedBeats: Beat[] = rawBeats
            .map((b: unknown, idx: number): Beat => {
                const row = asRecord(b) || {};
                const start = Number(row.start_sec);
                const end = Number(row.end_sec);
                const startSec = Number.isFinite(start)
                    ? Math.max(0, Math.min(dur - 1, Math.floor(start)))
                    : Math.floor((idx / denom) * dur);
                const endSec = Number.isFinite(end)
                    ? Math.max(startSec + 1, Math.min(dur, Math.floor(end)))
                    : Math.min(dur, startSec + Math.max(6, Math.floor(dur / 12)));
                return {
                    start_sec: startSec,
                    end_sec: endSec,
                    label: typeof row.label === 'string' && row.label.trim() ? row.label : `Beat ${idx + 1}`,
                    goal: typeof row.goal === 'string' ? row.goal : '',
                    caption: typeof row.caption === 'string' ? row.caption : '',
                };
            })
            .sort((a, b) => a.start_sec - b.start_sec);

        const rawShorts = Array.isArray(obj.shorts) ? (obj.shorts as unknown[]) : [];
        const cleanedShorts = rawShorts.slice(0, 10).map((s: unknown, idx: number) => {
            const row = asRecord(s) || {};
            const rawStart = typeof row.start_sec === 'number' ? row.start_sec : (cleanedBeats[idx]?.start_sec ?? 0);
            const rawEnd = typeof row.end_sec === 'number' ? row.end_sec : Math.min(dur, rawStart + 30);
            const startSec = Math.max(0, Math.min(dur - 1, Math.floor(rawStart)));
            const endSec = Math.max(startSec + 1, Math.min(dur, Math.floor(rawEnd)));
            return {
                start_sec: startSec,
                end_sec: endSec,
                title: typeof row.title === 'string' && row.title.trim() ? row.title : `Short #${idx + 1}`,
                hook: typeof row.hook === 'string' ? row.hook : '',
            };
        });

        const ex = asRecord(obj.exports) || {};
        const youtubeChapters =
            typeof ex.youtube_chapters === 'string' && ex.youtube_chapters.trim()
                ? ex.youtube_chapters
                : cleanedBeats.map((b) => `${fmtTime(b.start_sec)} ${b.label}`).join('\n') + '\n';
        const markersCsv =
            typeof ex.markers_csv === 'string' && ex.markers_csv.trim()
                ? ex.markers_csv
                : ['time_sec,label,comment']
                      .concat(
                          cleanedBeats.map(
                              (b) =>
                                  `${Math.floor(b.start_sec)},${String(b.label).replace(/,/g, ' ')},${String(b.goal || '').replace(/,/g, ' ')}`
                          )
                      )
                      .join('\n') + '\n';
        const shotlistMd =
            typeof ex.shotlist_md === 'string' && ex.shotlist_md.trim()
                ? ex.shotlist_md
                : cleanedBeats
                      .map((b) => `- **${fmtTime(b.start_sec)}–${fmtTime(b.end_sec)}** — ${b.label}${b.goal ? ` (${b.goal})` : ''}`)
                      .join('\n') + '\n';
        const brollPrompts =
            typeof ex.broll_prompts === 'string' && ex.broll_prompts.trim()
                ? ex.broll_prompts
                : cleanedBeats.map((b) => `- B-roll for: ${b.label}`).join('\n') + '\n';

        const pacingRaw = asRecord(obj.pacing) || {};
        const highlightsRaw = Array.isArray(pacingRaw.highlights) ? pacingRaw.highlights.slice(0, 8) : [];
        const boringRaw = Array.isArray(pacingRaw.boring_parts) ? pacingRaw.boring_parts.slice(0, 8) : [];
        const pacing = {
            highlights: highlightsRaw
                .map((it) => {
                    const r = asRecord(it) || {};
                    const start = Number(r.start_sec);
                    const end = Number(r.end_sec);
                    const startSec = Number.isFinite(start) ? Math.max(0, Math.min(dur - 1, Math.floor(start))) : 0;
                    const endSec = Number.isFinite(end) ? Math.max(startSec + 1, Math.min(dur, Math.floor(end))) : Math.min(dur, startSec + 10);
                    return {
                        start_sec: startSec,
                        end_sec: endSec,
                        why: typeof r.why === 'string' ? r.why : '',
                    };
                })
                .filter((x) => x.why.trim()),
            boring_parts: boringRaw
                .map((it) => {
                    const r = asRecord(it) || {};
                    const start = Number(r.start_sec);
                    const end = Number(r.end_sec);
                    const startSec = Number.isFinite(start) ? Math.max(0, Math.min(dur - 1, Math.floor(start))) : 0;
                    const endSec = Number.isFinite(end) ? Math.max(startSec + 1, Math.min(dur, Math.floor(end))) : Math.min(dur, startSec + 10);
                    return {
                        start_sec: startSec,
                        end_sec: endSec,
                        why: typeof r.why === 'string' ? r.why : '',
                        fix: typeof r.fix === 'string' ? r.fix : '',
                    };
                })
                .filter((x) => x.why.trim() || x.fix.trim()),
        };

        return {
            title: typeof obj.title === 'string' && obj.title.trim() ? obj.title : (title || (hasUrl ? 'Video' : 'Video')),
            duration_seconds: dur,
            beats: cleanedBeats,
            shorts: cleanedShorts,
            pacing: pacing.highlights.length || pacing.boring_parts.length ? pacing : undefined,
            exports: {
                youtube_chapters: youtubeChapters,
                markers_csv: markersCsv,
                shotlist_md: shotlistMd,
                broll_prompts: brollPrompts,
            },
        };
    }

    try {
        const parsed = JSON.parse(content) as unknown;
        return NextResponse.json(clampPack(parsed));
    } catch {
        return NextResponse.json({ detail: 'Invalid AI response' }, { status: 502 });
    }
}
