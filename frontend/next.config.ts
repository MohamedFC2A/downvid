import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for Docker deployments
  // Outputs static HTML/CSS/JS to 'out' directory
  // FastAPI serves these files via StaticFiles middleware
  output: 'export',

  // Required for static export - disable image optimization
  // Images will be served as-is without Next.js Image Optimization API
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

  // NOTE: rewrites() is NOT supported with static export
  // API calls go directly to NEXT_PUBLIC_BACKEND_URL from client-side
};

export default nextConfig;
