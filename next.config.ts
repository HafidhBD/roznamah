import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // The e2e runner uses its own build dir so it can run beside a developer's `next dev` (one per distDir).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Native/Node-only image libraries are loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ['sharp', 'node-vibrant'],
};

export default nextConfig;
