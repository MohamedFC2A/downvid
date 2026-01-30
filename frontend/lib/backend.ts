export const BACKEND_ORIGIN = (process.env.NEXT_PUBLIC_BACKEND_URL || "").trim().replace(/\/+$/, "");
export const API_BASE = BACKEND_ORIGIN ? `${BACKEND_ORIGIN}/api` : "/api";

export function apiUrl(path: string) {
    const p = path.startsWith("/") ? path : `/${path}`;
    if (p.startsWith("/api/") || p === "/api") return `${BACKEND_ORIGIN}${p}` || p;
    return `${API_BASE}${p}`;
}

