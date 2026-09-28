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
};

export default nextConfig;
