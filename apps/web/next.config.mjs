import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const API = process.env.API_URL ?? 'http://localhost:4000';
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: repoRoot,
  poweredByHeader: false,
  // Dev-only 'N' badge: bottom-left would sit on the sidebar's account row and controls.
  devIndicators: { position: 'bottom-right' },
  // Socket.IO asks for /socket.io/?… with a trailing slash; don't redirect it away.
  skipTrailingSlashRedirect: true,
  // Same-origin API: the browser talks to /api (and /socket.io) on the web origin, Next proxies to the API server.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API}/api/:path*` },
      { source: '/socket.io/', destination: `${API}/socket.io/` },
      { source: '/socket.io/:path*', destination: `${API}/socket.io/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
