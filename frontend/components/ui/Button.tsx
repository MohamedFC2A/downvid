import { cn } from "@/lib/utils";
import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary";
    loading?: boolean;
    children: React.ReactNode;
}

const Spinner = () => (
    <svg
        className="animate-spin h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
    >
        <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
        />
        <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
    </svg>
);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", loading = false, children, disabled, ...props }, ref) => {
        return (
            <button
                ref={ref}
                disabled={disabled || loading}
                className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:ring-[var(--foreground)]",
                    "disabled:pointer-events-none disabled:opacity-50",
                    "hover:scale-[1.02] active:scale-[0.98]",
                    variant === "primary"
                        ? "bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 shadow-sm"
                        : "bg-[var(--panel)] text-[var(--foreground)] border border-[var(--panel-border)] hover:bg-[var(--accent-soft)]",
                    loading && "cursor-wait",
                    className
                )}
                {...props}
            >
                {loading && <Spinner />}
                {children}
            </button>
        );
    }
);
Button.displayName = "Button";
