import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type UserEnv = {
    url: string;
    anonKey: string;
};

export function getUserEnv(): UserEnv | null {
    const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
    const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
    if (!url || !anonKey) return null;
    return { url, anonKey };
}

export function getSupabaseUserClient(bearerToken: string): { env: UserEnv; client: SupabaseClient } | null {
    const env = getUserEnv();
    const token = (bearerToken || '').trim();
    if (!env || !token) return null;
    const client = createClient(env.url, env.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
    return { env, client };
}

export async function getUserIdFromBearer(env: UserEnv, bearerToken: string): Promise<string | null> {
    const token = (bearerToken || '').trim();
    if (!token) return null;
    try {
        const res = await fetch(`${env.url}/auth/v1/user`, {
            method: 'GET',
            headers: {
                apikey: env.anonKey,
                Authorization: `Bearer ${token}`,
            },
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { id?: string };
        return typeof json?.id === 'string' ? json.id : null;
    } catch {
        return null;
    }
}

