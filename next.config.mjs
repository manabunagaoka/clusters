/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force Turbopack to treat this folder as the workspace root.
  // Fixes: "Next.js package not found" when a parent dir has another lockfile.
  turbopack: {
    root: process.cwd(),
  },
  // Align tracing root (used by non-Turbopack parts) with project root
  // to avoid any upstream workspace root inference.
  outputFileTracingRoot: process.cwd(),
  async rewrites() {
    const OLD = process.env.NEXT_PUBLIC_API_BASE || '';
    return OLD ? [{ source: '/api/:path*', destination: `${OLD}/api/:path*` }] : [];
  },
};
export default nextConfig;
