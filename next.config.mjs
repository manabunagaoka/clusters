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
  // TEMP: Allow production build while we backfill strict typing & lint cleanup.
  // Follow-up: remove eslint.ignoreDuringBuilds & typescript.ignoreBuildErrors
  // after addressing 'any' usage and unused vars across app/ & api/.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // We are not ignoring TS build errors, only ESLint. Keep strict type safety.
    // (If future blocking TS errors appear and we must ship, set this true briefly.)
    ignoreBuildErrors: false,
  },
  async rewrites() {
    const OLD = process.env.NEXT_PUBLIC_API_BASE || '';
    return OLD ? [{ source: '/api/:path*', destination: `${OLD}/api/:path*` }] : [];
  },
};
export default nextConfig;
