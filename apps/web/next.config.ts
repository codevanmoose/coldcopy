import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      'ui-avatars.com',
      'lh3.googleusercontent.com', // Google OAuth avatars
      'avatars.githubusercontent.com', // GitHub avatars
      'pbs.twimg.com', // Twitter avatars
      'media.licdn.com', // LinkedIn avatars
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
  },
  
  // Enable React strict mode for better error detection
  reactStrictMode: true,
  
  // Disable powered by header for security
  poweredByHeader: false,
  
  // SWC minification is enabled by default in Next.js 13+
  
  // Optimize production builds
  productionBrowserSourceMaps: false,
  
  // Configure compression
  compress: true,
  
  // Server external packages (moved from experimental)
  serverExternalPackages: ['prom-client', 'bull', 'ioredis', 'sharp'],
  
  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'recharts'],
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)'
          }
        ]
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0'
          }
        ]
      }
    ]
  },
  
  // Redirects for common routes
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
      {
        source: '/signin',
        destination: '/login',
        permanent: true,
      },
    ]
  },
  
  // Rewrites for API proxying (if needed)
  async rewrites() {
    return [
      // API rewrites can be added here if needed
    ]
  },
  
  // Webpack configuration
  webpack: (config, { isServer, webpack }) => {
    // Add polyfill for 'self' in server bundle
    if (isServer) {
      config.plugins.push(
        new webpack.DefinePlugin({
          self: 'global',
        })
      )
    }
    
    // Ignore node_modules in client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        path: false,
        os: false,
      }
    }
    
    // Add bundle analyzer in development
    if (process.env.ANALYZE === 'true') {
      const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: isServer ? '../analyze/server.html' : './analyze/client.html',
        })
      )
    }
    
    return config
  },
  
  // Output configuration
  output: 'standalone',
  
  // Trailing slash configuration
  trailingSlash: false,
  
  // Skip TypeScript errors in production build (use with caution)
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Skip ESLint during builds (we run it separately)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
}

// Export with Sentry wrapper if DSN is configured
export default process.env.NEXT_PUBLIC_SENTRY_DSN 
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;