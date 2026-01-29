import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type AdminEnv = {
    url: string;
    serviceRoleKey: string;
};

export function getAdminEnv(): AdminEnv | null {
    // Prefer server-only env, but allow falling back to the public URL
    // to reduce configuration footguns on Vercel.
    const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!url || !serviceRoleKey) return null;
    return { url, serviceRoleKey };
}

export function getSupabaseAdmin(): { env: AdminEnv; client: SupabaseClient } | null {
    const env = getAdminEnv();
    if (!env) return null;
    const client = createClient(env.url, env.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return { env, client };
}

export async function getUserIdFromBearer(env: AdminEnv, bearerToken: string): Promise<string | null> {
    const token = (bearerToken || '').trim();
    if (!token) return null;
    try {
        const res = await fetch(`${env.url}/auth/v1/user`, {
            method: 'GET',
            headers: {
                apikey: env.serviceRoleKey,
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
