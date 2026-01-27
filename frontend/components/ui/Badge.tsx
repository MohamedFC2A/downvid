import { cn } from "@/lib/utils";
import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
    return (
        <div
            className={cn(
                "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2",
                variant === "default"
                    ? "border-transparent bg-zinc-900 border-zinc-800 text-zinc-100 shadow hover:bg-zinc-800/80"
                    : "text-zinc-400 border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100",
                className
            )}
            {...props}
        />
    );
}
