'use client';
import React from 'react';

export const Logo = () => {
    return (
        <div className="relative flex items-center gap-3">
            <div className="relative group">
                <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-fuchsia-500/30 via-cyan-400/30 to-amber-300/30 blur-lg opacity-70 transition duration-700 group-hover:opacity-100" />
                <h1
                    className="relative text-3xl md:text-4xl font-black uppercase bg-gradient-to-r from-fuchsia-300 via-cyan-200 to-emerald-200 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(56,189,248,0.35)] tracking-[0.35em]"
                    style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900 }}
                >
                    DOWNVID
                </h1>
            </div>
            <span className="text-[10px] uppercase tracking-[0.35em] text-cyan-200/70 font-mono">Enterprise</span>
        </div>
    );
};
