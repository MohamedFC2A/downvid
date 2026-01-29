'use client';

export type PlatformId = 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'x' | 'unknown';

export function PlatformIcon({ platform, className }: { platform: PlatformId; className?: string }) {
    const common = `w-5 h-5 ${className || ''}`;
    switch (platform) {
        case 'youtube':
            return (
                <svg className={common} viewBox="0 0 24 24" aria-label="YouTube" role="img">
                    <path
                        fill="currentColor"
                        d="M23.2 7.3a4 4 0 0 0-2.8-2.8C18 4 12 4 12 4s-6 0-8.4.5A4 4 0 0 0 .8 7.3 41.6 41.6 0 0 0 .4 12c0 1.6.1 3.1.4 4.7a4 4 0 0 0 2.8 2.8C6 20 12 20 12 20s6 0 8.4-.5a4 4 0 0 0 2.8-2.8c.3-1.6.4-3.1.4-4.7s-.1-3.1-.4-4.7Zm-13 9.1V7.6L16.5 12l-6.3 4.4Z"
                    />
                </svg>
            );
        case 'tiktok':
            return (
                <svg className={common} viewBox="0 0 24 24" aria-label="TikTok" role="img">
                    <path
                        fill="currentColor"
                        d="M16.6 3c.6 3.4 2.6 5.4 6 6v3.4c-2 0-3.7-.6-5.2-1.8v6.6c0 4-3.2 7.3-7.3 7.3S2.8 21.2 2.8 17.2c0-4 3.2-7.3 7.3-7.3.4 0 .9 0 1.3.1v3.7c-.4-.1-.8-.2-1.3-.2-2 0-3.6 1.6-3.6 3.6S8 20.7 10 20.7s3.6-1.6 3.6-3.6V3h3Z"
                    />
                </svg>
            );
        case 'instagram':
            return (
                <svg className={common} viewBox="0 0 24 24" aria-label="Instagram" role="img">
                    <path
                        fill="currentColor"
                        d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Zm-5 4.2A3.8 3.8 0 1 1 8.2 12 3.8 3.8 0 0 1 12 8.2Zm0 2A1.8 1.8 0 1 0 13.8 12 1.8 1.8 0 0 0 12 10.2ZM18 6.6a1 1 0 1 1-1 1 1 1 0 0 1 1-1Z"
                    />
                </svg>
            );
        case 'facebook':
            return (
                <svg className={common} viewBox="0 0 24 24" aria-label="Facebook" role="img">
                    <path
                        fill="currentColor"
                        d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.2-1.5 1.5-1.5h1.7V4.6c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.6V11H7.1V14h2.4v8h4Z"
                    />
                </svg>
            );
        case 'x':
            return (
                <svg className={common} viewBox="0 0 24 24" aria-label="X" role="img">
                    <path
                        fill="currentColor"
                        d="M18.9 2H22l-6.8 7.8L23 22h-6.8l-5.3-6.9L4.7 22H2l7.4-8.5L1 2h7l4.8 6.1L18.9 2Zm-1.2 18h1.7L7.2 3.9H5.4L17.7 20Z"
                    />
                </svg>
            );
        default:
            return (
                <svg className={common} viewBox="0 0 24 24" aria-label="Link" role="img">
                    <path
                        fill="currentColor"
                        d="M10.6 13.4a1 1 0 0 1 0-1.4l3-3a1 1 0 1 1 1.4 1.4l-3 3a1 1 0 0 1-1.4 0ZM8.5 17.5a4 4 0 0 1 0-5.7l2-2a1 1 0 1 1 1.4 1.4l-2 2a2 2 0 1 0 2.8 2.8l2-2a1 1 0 0 1 1.4 1.4l-2 2a4 4 0 0 1-5.6 0Zm7-11a4 4 0 0 1 0 5.7l-2 2a1 1 0 0 1-1.4-1.4l2-2a2 2 0 1 0-2.8-2.8l-2 2A1 1 0 1 1 7.9 7.8l2-2a4 4 0 0 1 5.6 0Z"
                    />
                </svg>
            );
    }
}

