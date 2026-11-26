import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Native/Node-only image libraries are loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ['sharp', 'node-vibrant'],
};

export default nextConfig;
