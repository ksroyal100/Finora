import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't advertise the framework
  reactStrictMode: true,

  // Single-app env passthrough. There is now only one public URL for this
  // app (NEXT_PUBLIC_APP_URL) — the old NEXT_PUBLIC_API_URL / NEXT_PUBLIC_UI_URL
  // split only exists for backward-compatible relative-path fallbacks.
  env: {
    NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL      ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    NEXT_PUBLIC_APP_URL:           process.env.NEXT_PUBLIC_APP_URL           ?? 'http://localhost:3000',
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
    ],
  },

  experimental: {
    serverActions: {
      allowedOrigins: [
        (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/^https?:\/\//, ''),
      ],
    },
  },

  webpack(config) {
    config.experiments = { ...config.experiments, topLevelAwait: true }
    return config
  },

  // Security headers, applied to every route
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
      {
        // API responses hold user financial/account data — never let a CDN
        // or browser cache them.
        source: '/api/(.*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ]
  },

  async redirects() {
    return [
      { source: '/app',      destination: '/dashboard', permanent: false },
      { source: '/login',    destination: '/signin',    permanent: true },
      { source: '/register', destination: '/signup',    permanent: true },
    ]
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps when an auth token is present (e.g. in CI) —
  // without one, this step is skipped with a log line, never a build failure.
  silent: true,
  widenClientFileUpload: false,
  webpack: {
    automaticVercelMonitors: false,
    treeshake: { removeDebugLogging: true },
  },
})
