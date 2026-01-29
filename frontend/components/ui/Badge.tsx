import { cn } from "@/lib/utils";
import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
    return (
        <div
            className={cn(
                "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)] focus:ring-offset-2",
                variant === "default"
                    ? "border-[var(--panel-border)] bg-[var(--panel)] text-[var(--foreground)] shadow hover:opacity-90"
                    : "text-[var(--foreground)] opacity-70 border-[var(--panel-border)] hover:bg-[var(--accent-soft)] hover:opacity-100",
                className
            )}
            {...props}
        />
    );
}
