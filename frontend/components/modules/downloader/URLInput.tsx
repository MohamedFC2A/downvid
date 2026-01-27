'use client';
import React, { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface URLInputProps {
    onUrlSubmit: (url: string) => void;
    // Legacy props maybe needed by parent but we ignore
    clientId?: string;
    onStatusUpdate?: any;
}

export function URLInput({ onUrlSubmit }: URLInputProps) {
    const [url, setUrl] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;
        onUrlSubmit(url);
    };

    return (
        <form onSubmit={handleSubmit} className="flex gap-4 w-full max-w-2xl">
            <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste video URL (e.g., YouTube)..."
                className="flex-1 h-12 text-lg"
                autoFocus
            />
            <Button type="submit" variant="primary" className="h-12 px-8 text-base shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                Analyze
            </Button>
        </form>
    );
}
