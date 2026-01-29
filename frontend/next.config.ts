import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Default: run as a normal Next.js app (supports Route Handlers like /api/* on Vercel).
  //
  // If you need static export for a single-container deployment (FastAPI serving frontend/out),
  // you must remove/disable Route Handlers first.
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.ytimg.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'p16-sign-va.tiktokcdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.tiktokcdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'scontent.cdninstagram.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.cdninstagram.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'instagram.*.fbcdn.net',
        pathname: '/**',
      },
    ],
  },

  // API calls can be served by Next Route Handlers under /api/* (recommended on Vercel),
  // or by an external backend if you set NEXT_PUBLIC_BACKEND_URL in the browser env.
};

export default nextConfig;
