import { cn } from "@/lib/utils";
import React from "react";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    "flex h-10 w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--foreground)]",
                    "placeholder:text-[var(--foreground)] placeholder:opacity-50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:ring-[var(--foreground)] focus-visible:border-[var(--foreground)]",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "transition-all duration-200 ease-out",
                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);
Input.displayName = "Input";
