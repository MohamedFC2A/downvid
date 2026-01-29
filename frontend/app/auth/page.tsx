'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/Logo';
import { t } from '@/lib/i18n';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';

export default function AuthPage() {
    const { settings } = useSettings();
    const lang = settings.language;
    const auth = useAuth();
    const supabase = useMemo(() => getSupabaseClient(), []);

    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const redirectTo = useMemo(() => {
        if (typeof window === 'undefined') return undefined;
        const configured = process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL;
        if (configured && configured.trim()) return configured.trim();
        return `${window.location.origin}/auth/callback`;
    }, []);

    async function onGoogle() {
        if (!supabase) return;
        setBusy(true);
        setMessage(null);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                },
            });
            if (error) throw error;
        } catch (e) {
            setMessage(e instanceof Error ? e.message : t(lang, 'auth.failed'));
        } finally {
            setBusy(false);
        }
    }

    async function onSubmit() {
        if (!supabase) return;
        setBusy(true);
        setMessage(null);
        try {
            if (!email.trim() || !password) {
                setMessage(t(lang, 'auth.missingFields'));
                return;
            }
            if (mode === 'signin') {
                const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
                if (error) throw error;
            } else {
                const { error } = await supabase.auth.signUp({ email: email.trim(), password });
                if (error) throw error;
                setMessage(t(lang, 'auth.signupHint'));
            }
        } catch (e) {
            setMessage(e instanceof Error ? e.message : t(lang, 'auth.failed'));
        } finally {
            setBusy(false);
        }
    }

    async function onSignOut() {
        if (!supabase) return;
        setBusy(true);
        setMessage(null);
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        } catch (e) {
            setMessage(e instanceof Error ? e.message : t(lang, 'auth.failed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="min-h-screen pt-28 pb-20 px-6">
            <div className="mx-auto w-full max-w-xl">
                <div className="flex items-center justify-between gap-4">
                    <Logo />
                    <Link href="/subscriptions" className="text-xs font-mono text-[var(--foreground)] opacity-70 underline underline-offset-4">
                        {t(lang, 'subs.seePlans')}
                    </Link>
                </div>

                <div className="mt-8 rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[var(--glass-shadow)]">
                    <div className="mb-6">
                        <div className={`text-xs font-mono text-[var(--foreground)] opacity-60 ${lang === 'ar' ? '' : 'uppercase tracking-[0.3em]'}`}>
                            {t(lang, 'auth.kicker')}
                        </div>
                        <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{t(lang, 'auth.title')}</h1>
                        {!auth.configured && (
                            <p className="mt-2 text-sm text-[var(--foreground)] opacity-70">{t(lang, 'auth.notConfigured')}</p>
                        )}
                    </div>

                    {auth.user ? (
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4">
                                <div className="text-xs font-mono opacity-70">{t(lang, 'auth.signedInAs')}</div>
                                <div className="mt-2 text-sm font-semibold break-all">{auth.user.email}</div>
                            </div>
                            {message && <div className="text-xs text-[var(--foreground)] opacity-75">{message}</div>}
                            <Button className="h-11 w-full" onClick={onSignOut} disabled={busy || !supabase}>
                                {t(lang, 'auth.signOut')}
                            </Button>
                        </div>
                    ) : (
                    <div className="space-y-4">
                            <Button
                                variant="secondary"
                                className="h-11 w-full"
                                onClick={onGoogle}
                                disabled={busy || !supabase}
                            >
                                {t(lang, 'auth.continueGoogle')}
                            </Button>

                            <div className="flex items-center gap-3">
                                <div className="h-px w-full bg-[var(--panel-border)]" />
                                <div className="text-[11px] font-mono text-[var(--foreground)] opacity-60">{t(lang, 'auth.or')}</div>
                                <div className="h-px w-full bg-[var(--panel-border)]" />
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant={mode === 'signin' ? 'primary' : 'secondary'}
                                    className="h-9 flex-1"
                                    onClick={() => setMode('signin')}
                                    disabled={busy}
                                >
                                    {t(lang, 'auth.signIn')}
                                </Button>
                                <Button
                                    variant={mode === 'signup' ? 'primary' : 'secondary'}
                                    className="h-9 flex-1"
                                    onClick={() => setMode('signup')}
                                    disabled={busy}
                                >
                                    {t(lang, 'auth.signUp')}
                                </Button>
                            </div>

                            <div className="space-y-3">
                                <Input
                                    placeholder={t(lang, 'auth.email')}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={busy || !supabase}
                                    autoComplete="email"
                                />
                                <Input
                                    placeholder={t(lang, 'auth.password')}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={busy || !supabase}
                                    type="password"
                                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                                />
                            </div>

                            {message && <div className="text-xs text-[var(--foreground)] opacity-75">{message}</div>}

                            <Button className="h-11 w-full" onClick={onSubmit} disabled={busy || !supabase}>
                                {mode === 'signin' ? t(lang, 'auth.signIn') : t(lang, 'auth.signUp')}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
