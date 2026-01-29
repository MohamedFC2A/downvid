import { cn } from "@/lib/utils";
import React from 'react';

interface TerminalBlockProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    title?: string;
}

export function TerminalBlock({ className, children, title = "TERMINAL", ...props }: TerminalBlockProps) {
    return (
        <div className={cn("overflow-hidden rounded-lg border border-[var(--panel-border)] bg-[var(--deep)]", className)} {...props}>
            <div className="flex items-center justify-between border-b border-[var(--panel-border)] bg-[var(--panel)] px-4 py-2">
                <div className="flex space-x-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500/20 border border-green-500/50" />
                </div>
                <div className="text-xs font-mono text-[var(--foreground)] opacity-60 tracking-widest">{title}</div>
                <div className="w-12" /> {/* Spacer for centering */}
            </div>
            <div className="p-4 font-mono text-sm text-[var(--foreground)] opacity-80">
                {children}
            </div>
        </div>
    );
}
