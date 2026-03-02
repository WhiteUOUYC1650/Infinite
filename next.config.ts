import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Robust fix for Node.js modules in client-side bundles (like APK/Browser)
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        child_process: false,
        net: false,
        tls: false,
        os: false,
        path: false,
        stream: false,
        crypto: false,
        http: false,
        https: false,
        zlib: false,
        dns: false,
        vm: false,
        perf_hooks: false,
        worker_threads: false,
        module: false,
        util: false,
        process: false,
        async_hooks: false,
        canvas: false,
        'node:async_hooks': false,
        'node:child_process': false,
        'node:fs': false,
        'node:path': false,
        'node:os': false,
        'node:crypto': false,
        'node:stream': false,
        'node:http': false,
        'node:https': false,
        'node:zlib': false,
        'node:util': false,
        'node:dns': false,
        'node:net': false,
        'node:tls': false,
      };
    }
    return config;
  },
};

export default nextConfig;