// WebSocket client for download progress updates
// Production-ready for container deployments (same-origin by default)

export type DownloadStatus = {
    status: string;
    percent: number;
    speed?: string;
    eta?: string;
    downloaded_bytes?: number;
    total_bytes?: number;
    file?: string;
    message?: string;
    error?: string;
    file_token?: string;
    filename?: string;
    note?: string;
};

/**
 * Get the WebSocket URL for the backend.
 * Uses NEXT_PUBLIC_WS_URL if set, otherwise derives from NEXT_PUBLIC_BACKEND_URL,
 * otherwise falls back to current host (for same-origin deployments).
 */
function getWebSocketUrl(clientId: string, accessToken?: string | null): string {
    // First check for explicit WebSocket URL
    const qs = accessToken ? `?access_token=${encodeURIComponent(accessToken)}` : '';

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (wsUrl) {
        return `${wsUrl}/api/download/${clientId}${qs}`;
    }

    // Derive from backend URL (convert http(s) to ws(s))
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (backendUrl) {
        const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
        const hostPart = backendUrl.replace(/^https?:\/\//, '');
        return `${wsProtocol}://${hostPart}/api/download/${clientId}${qs}`;
    }

    // Fallback: same origin (for local dev or single-container deploys)
    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/api/download/${clientId}${qs}`;
    }

    // Server-side fallback (shouldn't be used for WebSocket)
    return `ws://localhost:8000/api/download/${clientId}${qs}`;
}

export class WebSocketClient {
    private ws: WebSocket | null = null;
    private url: string;
    private onMessage: (data: DownloadStatus) => void;
    private clientId: string;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 50;
    private shouldReconnect: boolean = true;
    private reconnectTimer: number | null = null;
    private sendQueue: string[] = [];

    constructor(clientId: string, onMessage: (data: DownloadStatus) => void, opts?: { accessToken?: string | null }) {
        this.clientId = clientId;
        this.url = getWebSocketUrl(clientId, opts?.accessToken);
        this.onMessage = onMessage;
        console.log(`[WS] URL: ${this.url}`);
    }

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('[WS] Already connected');
            return;
        }
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            return;
        }
        if (this.reconnectTimer) {
            window.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log('[WS] Connected');
                this.reconnectAttempts = 0;
                // Flush queued messages
                const queued = this.sendQueue.splice(0, this.sendQueue.length);
                for (const msg of queued) {
                    try {
                        this.ws?.send(msg);
                    } catch {
                        this.sendQueue.unshift(msg);
                        break;
                    }
                }
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.onMessage(data);
                } catch (e) {
                    console.error('[WS] Failed to parse message', e);
                }
            };

            this.ws.onclose = (event) => {
                console.log(`[WS] Closed (code: ${event.code}, reason: ${event.reason})`);
                this.ws = null;
                if (this.shouldReconnect) {
                    this.scheduleReconnect();
                }
            };

            this.ws.onerror = (err) => {
                console.error('[WS] Error:', err);
                // Log more details for debugging
                console.error('[WS] URL was:', this.url);
            };
        } catch (error) {
            console.error('[WS] Connection error:', error);
            if (this.shouldReconnect) {
                this.scheduleReconnect();
            }
        }
    }

    private scheduleReconnect() {
        if (!this.shouldReconnect) return;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WS] Max reconnect attempts reached');
            return;
        }

        const base = 500; // ms
        const max = 8000; // ms
        const exp = Math.min(max, base * Math.pow(2, this.reconnectAttempts));
        const jitter = Math.floor(Math.random() * 250);
        const delay = exp + jitter;
        this.reconnectAttempts += 1;

        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    }

    sendUrl(url: string) {
        this.send({ url });
    }

    sendDownloadCommand(url: string, formatId: string, mode: 'video' | 'audio') {
        this.send({
            action: 'start_download',
            url,
            format_id: formatId,
            mode
        });
    }

    sendDownloadSpec(url: string, spec: { mode: 'video' | 'audio'; container?: string; height?: number; format_id?: string }) {
        this.send({
            action: 'start_download',
            url,
            mode: spec.mode,
            container: spec.container,
            height: spec.height,
            format_id: spec.format_id,
        });
    }

    private send(data: Record<string, unknown>) {
        const payload = JSON.stringify(data);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(payload);
            return;
        }

        // Queue and connect
        this.sendQueue.push(payload);
        this.connect();
    }

    close() {
        this.shouldReconnect = false;
        if (this.reconnectTimer) {
            window.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}
