import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Tell Next.js to treat pdf-parse as external for server components
  // This prevents webpack from bundling it
  serverExternalPackages: ['pdf-parse'],
  
  webpack: (config, { isServer }) => {
    // Only apply fallbacks for client-side builds
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
      };
    }

    return config;
  },
};

export default nextConfig;
