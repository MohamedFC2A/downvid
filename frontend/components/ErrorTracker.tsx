"use client";

import { useEffect } from "react";

export function ErrorTracker() {
    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            console.group("🚨 Global Error Detected");
            console.error(`Message: ${event.message}`);
            console.error(`File: ${event.filename}:${event.lineno}:${event.colno}`);
            console.error("Error Object:", event.error);
            console.groupEnd();

            // Optional: Send to analytics or backend logging endpoint here
        };

        const handleRejection = (event: PromiseRejectionEvent) => {
            console.group("🚨 Unhandled Promise Rejection");
            console.error("Reason:", event.reason);
            console.groupEnd();
        };

        window.addEventListener("error", handleError);
        window.addEventListener("unhandledrejection", handleRejection);

        return () => {
            window.removeEventListener("error", handleError);
            window.removeEventListener("unhandledrejection", handleRejection);
        };
    }, []);

    return null; // This component does not render anything visual
}
