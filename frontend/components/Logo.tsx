'use client';
import React from 'react';

export const Logo = () => {
    return (
        <div className="flex items-center gap-3">
            <div className="relative">
                <div
                    className="text-2xl md:text-3xl font-black uppercase tracking-[0.32em] text-[var(--foreground)]"
                    style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900 }}
                >
                    DOWNVID
                </div>
            </div>
            <span className="hidden sm:inline-flex rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-2.5 py-1 text-[10px] uppercase tracking-[0.28em] text-[var(--foreground)] opacity-70 font-mono">
                Enterprise
            </span>
        </div>
    );
};
