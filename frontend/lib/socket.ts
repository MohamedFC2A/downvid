// WebSocket client for download progress updates
// Production-ready for Fly.io deployment

export type DownloadStatus = {
    status: string;
    percent: number;
    speed?: string;
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
function getWebSocketUrl(clientId: string): string {
    // First check for explicit WebSocket URL
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (wsUrl) {
        return `${wsUrl}/api/download/${clientId}`;
    }

    // Derive from backend URL (convert http(s) to ws(s))
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (backendUrl) {
        const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
        const hostPart = backendUrl.replace(/^https?:\/\//, '');
        return `${wsProtocol}://${hostPart}/api/download/${clientId}`;
    }

    // Fallback: same origin (for local dev or single-container deploys)
    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/api/download/${clientId}`;
    }

    // Server-side fallback (shouldn't be used for WebSocket)
    return `ws://localhost:8000/api/download/${clientId}`;
}

export class WebSocketClient {
    private ws: WebSocket | null = null;
    private url: string;
    private onMessage: (data: DownloadStatus) => void;
    private clientId: string;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 3;

    constructor(clientId: string, onMessage: (data: DownloadStatus) => void) {
        this.clientId = clientId;
        this.url = getWebSocketUrl(clientId);
        this.onMessage = onMessage;
        console.log(`[WS] URL: ${this.url}`);
    }

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('[WS] Already connected');
            return;
        }

        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log('[WS] Connected');
                this.reconnectAttempts = 0;
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
            };

            this.ws.onerror = (err) => {
                console.error('[WS] Error:', err);
                // Log more details for debugging
                console.error('[WS] URL was:', this.url);
            };
        } catch (error) {
            console.error('[WS] Connection error:', error);
        }
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

    private send(data: Record<string, unknown>) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('[WS] Not open, attempting connect...');
            this.connect();

            // Retry after connection attempt
            setTimeout(() => {
                if (this.ws?.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify(data));
                } else {
                    console.error('[WS] Failed to send - connection not established');
                }
            }, 1500);
        }
    }

    close() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}
