'use client';
import React from 'react';

export const Logo = () => {
    return (
        <div className="relative flex justify-center items-center">
            {/* Import Font specifically for the logo if needed */}
            <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
      `}</style>

            <svg
                width="200"
                height="60"
                viewBox="0 0 200 60"
                xmlns="http://www.w3.org/2000/svg"
                className="w-40 md:w-48 hover:scale-105 transition-transform duration-300 drop-shadow-lg"
            >
                <defs>
                    {/* Defined the Curve Path: Arches up in the middle */}
                    <path id="curvePath" d="M 10 50 Q 100 25 190 50" />

                    {/* Golden Gradient */}
                    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FACC15" /> {/* Yellow-400 */}
                        <stop offset="100%" stopColor="#CA8A04" /> {/* Yellow-600 */}
                    </linearGradient>

                    {/* Subtle Glow Filter */}
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                <text
                    width="200"
                    fontFamily="'Bebas Neue', sans-serif"
                    fontSize="52"
                    fontWeight="bold"
                    fill="url(#goldGradient)"
                    style={{ letterSpacing: '4px' }}
                >
                    <textPath
                        href="#curvePath"
                        startOffset="50%"
                        textAnchor="middle"
                        method="align"
                        spacing="auto"
                    >
                        DOWNVID
                    </textPath>
                </text>
            </svg>
        </div>
    );
};
