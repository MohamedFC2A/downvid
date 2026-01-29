'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

export type AuthState = {
    configured: boolean;
    loading: boolean;
    session: Session | null;
    user: User | null;
    accessToken: string | null;
};

export function useAuth(): AuthState {
    const supabase = useMemo(() => getSupabaseClient(), []);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(isSupabaseConfigured);

    useEffect(() => {
        if (!supabase) return;

        let mounted = true;
        supabase.auth.getSession().then(({ data }) => {
            if (!mounted) return;
            setSession(data.session ?? null);
            setLoading(false);
        });

        const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
        });

        return () => {
            mounted = false;
            sub.subscription.unsubscribe();
        };
    }, [supabase]);

    return {
        configured: isSupabaseConfigured,
        loading,
        session,
        user: session?.user ?? null,
        accessToken: session?.access_token ?? null,
    };
}
