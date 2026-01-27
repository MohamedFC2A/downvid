const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL
    ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api`
    : "/api";

export async function analyzeVideo(url: string) {
    const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Analysis failed");
    }
    return res.json();
}

export async function getFileDownloadUrl(fileToken: string): Promise<string> {
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    return `${baseUrl}/api/file/serve/${fileToken}`;
}
