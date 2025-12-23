import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Tell Next.js to treat pdf-parse as external for server components
  // This prevents webpack from bundling it
  serverExternalPackages: ['pdf-parse'],

  // Allow cross-origin requests from VM/Docker networks during development
  allowedDevOrigins: ['192.168.56.1', '192.168.1.19'],

  // Temporarily ignore ESLint errors during build (pre-existing issues)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable static page generation to avoid useSearchParams Suspense issues
  output: 'standalone',

  // Increase body size limit for large dataset uploads (250MB for DPO datasets)
  experimental: {
    serverActions: {
      bodySizeLimit: '250mb',
    },
  },

  // Development optimizations
  ...(process.env.NODE_ENV === 'development' && {
    // Reduce initial compilation time
    productionBrowserSourceMaps: false,
  }),

  // Production build memory optimizations
  ...(process.env.NODE_ENV === 'production' && {
    // Disable source maps in production to save memory
    productionBrowserSourceMaps: false,

    // Reduce build parallelism to save memory
    experimental: {
      ...((process.env.NODE_ENV === 'production') && {
        workerThreads: false,
        cpus: 1,
      }),
    },
  }),

  webpack: (config, { isServer, dev, dir }) => {
    // Production build memory optimizations
    if (!dev) {
      // Reduce memory usage during production builds
      config.optimization = {
        ...config.optimization,
        minimize: true,
        // Use single-threaded minification to save memory
        minimizer: config.optimization.minimizer,
        // Reduce chunk splitting complexity
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Simplified chunking strategy
            commons: {
              name: 'commons',
              chunks: 'all',
              minChunks: 2,
              priority: 10,
            },
          },
        },
      };

      // Disable performance hints to reduce memory overhead
      config.performance = {
        hints: false,
      };
    }

    // Optimize file watching in development to prevent "too many open files" error
    if (dev) {
      const projectRoot = dir || process.cwd();
      
      config.watchOptions = {
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/.git/**',
          '**/docs/**',
          '**/migrations/**',
          '**/migrations.backup/**',
          '**/docs.backup/**',
          '**/.venv/**',
          '**/venv/**',
          '**/test_venv/**',
          '**/trainer_venv/**',
          '**/graphiti-wrapper/**',
          '**/graphiti-main/**',
          '**/__pycache__/**',
          '**/*.pyc',
        ],
        aggregateTimeout: 300,
        poll: 1000,
      };
      
      // CRITICAL: Prevent webpack from following symlinks (.venv/bin/python3 -> /bin/python3)
      // and set context to prevent upward directory traversal
      config.resolve = config.resolve || {};
      config.resolve.symlinks = false;
      config.context = projectRoot;
    }
    
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

    // Ignore optional platform-specific dependencies from systeminformation
    // These are only needed on specific operating systems
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push({
        'osx-temperature-sensor': 'commonjs osx-temperature-sensor',
        '@zebrajaeger/node-powershell': 'commonjs @zebrajaeger/node-powershell',
      });
    }

    return config;
  },
};

export default nextConfig;
