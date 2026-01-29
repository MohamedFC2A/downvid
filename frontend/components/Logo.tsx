'use client';
import React from 'react';

export const Logo = () => {
    return (
        <div className="relative flex justify-center items-center">
            <div className="relative group">
                {/* Glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-cyan-400 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>

                {/* Main Text */}
                <h1 className="relative text-4xl md:text-5xl font-black tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-cyan-400 to-purple-400 animate-gradient-x font-[var(--font-montserrat)]">
                    DOWNVID
                    <span className="text-xs absolute -top-1 -right-4 text-cyan-300 font-mono tracking-normal opacity-70">PREMIUM</span>
                </h1>
            </div>
        </div>
    );
};
