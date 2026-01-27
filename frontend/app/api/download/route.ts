import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const url = searchParams.get('url');
        const format = searchParams.get('format') || 'mp4';
        const quality = searchParams.get('quality') || '1080p';

        if (!url) {
            return NextResponse.json(
                { error: 'URL parameter is required' },
                { status: 400 }
            );
        }

        const response = await fetch(
            `${BACKEND_URL}/api/download?url=${encodeURIComponent(url)}&format=${format}&quality=${quality}`
        );

        if (!response.ok) {
            const error = await response.json();
            return NextResponse.json(
                { error: error.detail || 'Failed to download video' },
                { status: response.status }
            );
        }

        // Stream the response
        return new NextResponse(response.body, {
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
                'Content-Disposition': response.headers.get('Content-Disposition') || 'attachment',
            },
        });
    } catch (error) {
        console.error('Download API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
