import type { NextConfig } from "next";
import path from "path";

// Explicit, not auto-detected: Next.js's standalone tracing walks the
// filesystem upward looking for lockfiles and uses the outermost one it
// finds (node_modules/next/dist/lib/find-root.js) — an unrelated lockfile
// above this repo would silently hijack the tracing root. Point it at the
// true monorepo root instead of relying on that walk.
const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Google sign-in creates the account on first login, so signup is login.
  async redirects() {
    return [{ source: '/signup', destination: '/login', permanent: false }];
  },
  // Baseline security headers on every response. Not a script CSP yet: Leaflet
  // tiles and inline styles need a nonce-based policy, tested separately.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // No framing (clickjacking on login/logout and every signed-in page).
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Full URLs (OAuth codes, listing ids) never leave the site in Referer.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(), geolocation=(self)' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
        ],
      },
    ];
  },
};

export default nextConfig;
