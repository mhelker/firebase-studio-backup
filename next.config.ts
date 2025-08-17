import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true, // Disable image optimization for static export
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'imgur.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Remove this line to disable static export mode:
  // output: 'export',

  webpack(config) {
    // Add handlebars loader for .js files inside handlebars package
    config.module.rules.push({
      test: /\.js$/,
      include: /node_modules\/handlebars/,
      use: {
        loader: 'handlebars-loader',
      },
    });

    // Suppress require.extensions warning
    config.ignoreWarnings = [
      {
        message: /require\.extensions is not supported by webpack/,
      },
    ];

    return config;
  },
};

export default nextConfig;