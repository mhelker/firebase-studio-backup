import type { NextConfig } from 'next';
import path from 'path'; // Import the 'path' module

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
    // ** ADD THIS BLOCK TO FIX THE BUILD ERROR **
    // Forcing the resolution of conflicting template packages
    config.resolve.alias = {
      ...config.resolve.alias,
      'string-template': path.resolve(__dirname, 'node_modules/string-template'),
      'url-template': path.resolve(__dirname, 'node_modules/url-template'),
      'uri-templates': path.resolve(__dirname, 'node_modules/uri-templates'),
    };

    // Your existing webpack configurations are preserved below
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