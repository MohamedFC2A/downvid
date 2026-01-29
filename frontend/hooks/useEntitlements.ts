'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const API_BASE = '/api';

export type Entitlements = {
    loading: boolean;
    error: string | null;
    plan: 'free' | 'ultimate' | 'unknown';
    downloadsUsed: number | null;
    downloadsRemaining: number | null; // null => unlimited / unknown
    ultimateUntil: string | null;
    aiEnabled: boolean;
    refresh: () => Promise<void>;
};

export function useEntitlements(): Entitlements {
    const { accessToken, configured } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [plan, setPlan] = useState<Entitlements['plan']>('unknown');
    const [downloadsUsed, setDownloadsUsed] = useState<number | null>(null);
    const [downloadsRemaining, setDownloadsRemaining] = useState<number | null>(null);
    const [ultimateUntil, setUltimateUntil] = useState<string | null>(null);
    const [aiEnabled, setAiEnabled] = useState(false);

    const headers = useMemo(() => {
        if (!accessToken) return null;
        return { Authorization: `Bearer ${accessToken}` };
    }, [accessToken]);

    const refresh = useCallback(async () => {
        // If Supabase is configured but user isn't logged in yet, skip calling /api/me to avoid noisy 401s.
        // Downloads are already blocked behind login in the UI.
        if (configured && !headers) {
            setLoading(false);
            setError(null);
            setPlan('free');
            setDownloadsUsed(0);
            setDownloadsRemaining(5);
            setUltimateUntil(null);
            setAiEnabled(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/me`, { headers: headers ?? undefined });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    setPlan('free');
                    setDownloadsUsed(null);
                    setDownloadsRemaining(null);
                    setAiEnabled(false);
                    return;
                }
                throw new Error(json?.detail || json?.error || 'Failed to load subscription');
            }

            const nextPlan = (json?.plan || 'free').toString().toLowerCase();
            setPlan(nextPlan === 'ultimate' ? 'ultimate' : 'free');
            setDownloadsUsed(typeof json?.downloads_used === 'number' ? json.downloads_used : 0);
            const remaining = json?.downloads_remaining;
            setDownloadsRemaining(typeof remaining === 'number' ? remaining : null);
            setAiEnabled(Boolean(json?.ai_enabled));
            setUltimateUntil(typeof json?.ultimate_until === 'string' ? json.ultimate_until : null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load subscription');
            setPlan('unknown');
            setDownloadsUsed(null);
            setDownloadsRemaining(null);
            setUltimateUntil(null);
            setAiEnabled(false);
        } finally {
            setLoading(false);
        }
    }, [configured, headers]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        loading,
        error,
        plan,
        downloadsUsed,
        downloadsRemaining,
        ultimateUntil,
        aiEnabled,
        refresh,
    };
}
