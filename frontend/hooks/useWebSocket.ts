import { useEffect, useRef, useState, useCallback } from 'react';

interface DownloadProgress {
    type: string;
    percentage?: number;
    downloaded?: string;
    total?: string;
    speed?: string;
    eta?: string;
    status?: string;
    message?: string;
    error?: string;
    file_path?: string;
}

interface UseWebSocketReturn {
    isConnected: boolean;
    progress: DownloadProgress | null;
    error: string | null;
    startDownload: (url: string, format: string, quality: string) => void;
    disconnect: () => void;
}

export function useWebSocket(clientId: string): UseWebSocketReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [progress, setProgress] = useState<DownloadProgress | null>(null);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return; // Already connected
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//localhost:8000/ws/download/${clientId}`;

        try {
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                setError(null);
            };

            ws.onmessage = (event) => {
                try {
                    const data: DownloadProgress = JSON.parse(event.data);
                    setProgress(data);

                    if (data.type === 'error') {
                        setError(data.error || 'Unknown error occurred');
                    } else if (data.type === 'complete') {
                        // Download complete
                        console.log('Download complete:', data.file_path);
                    }
                } catch (e) {
                    console.error('Failed to parse WebSocket message:', e);
                }
            };

            ws.onerror = (event) => {
                console.error('WebSocket error:', event);
                setError('WebSocket connection error');
                setIsConnected(false);
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);
            };

            wsRef.current = ws;
        } catch (e) {
            console.error('Failed to create WebSocket:', e);
            setError('Failed to connect to server');
        }
    }, [clientId]);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
            setIsConnected(false);
            setProgress(null);
        }
    }, []);

    const startDownload = useCallback(
        (url: string, format: string, quality: string) => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                setError('Not connected to server');
                return;
            }

            setProgress(null);
            setError(null);

            // Send download request
            wsRef.current.send(
                JSON.stringify({
                    url,
                    format,
                    quality,
                })
            );
        },
        []
    );

    // Auto-connect on mount
    useEffect(() => {
        connect();

        return () => {
            disconnect();
        };
    }, [connect, disconnect]);

    return {
        isConnected,
        progress,
        error,
        startDownload,
        disconnect,
    };
}
