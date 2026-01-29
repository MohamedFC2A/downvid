'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';
import { getSupabaseClient } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';
import { t } from '@/lib/i18n';

export default function AuthCallbackPage() {
    const { settings } = useSettings();
    const lang = settings.language;
    const supabase = useMemo(() => getSupabaseClient(), []);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!supabase) return;

        let cancelled = false;
        (async () => {
            try {
                // For PKCE flows, Supabase will redirect back with ?code=...
                // Exchange the code for a session.
                const { error: exError } = await supabase.auth.exchangeCodeForSession(window.location.href);
                if (exError) throw exError;
                if (cancelled) return;
                window.location.replace('/tool');
            } catch (e) {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : t(lang, 'auth.failed'));
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [supabase, lang]);

    return (
        <main className="min-h-screen pt-28 pb-20 px-6">
            <div className="mx-auto w-full max-w-xl">
                <Logo />

                <div className="mt-8 rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[var(--glass-shadow)]">
                    <div className="text-sm text-[var(--foreground)] opacity-80">
                        {t(lang, 'auth.callbackWorking')}
                    </div>

                    {error && (
                        <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <div className="mt-6 flex gap-3">
                        <Link href="/auth" className="flex-1">
                            <Button variant="secondary" className="h-11 w-full">
                                {t(lang, 'auth.backToLogin')}
                            </Button>
                        </Link>
                        <Link href="/tool" className="flex-1">
                            <Button className="h-11 w-full">
                                {t(lang, 'subs.goTool')}
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}

