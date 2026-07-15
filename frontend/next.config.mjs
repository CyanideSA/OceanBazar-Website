import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';
import { getCspHeaderPair } from './csp-headers.mjs';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const isStaticExport = process.env.NEXT_STATIC_EXPORT === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isStaticExport
    ? { output: 'export', trailingSlash: false }
    : { output: 'standalone' }),

  images: {
    ...(isStaticExport ? { unoptimized: true } : {}),
    localPatterns: [
      { pathname: '/ob-brand-logo.png' },
      { pathname: '/ob-footer-logo.png' },
      { pathname: '/header-logo.jpg' },
    ],
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '4000' },
      { protocol: 'https', hostname: '*.oceanbazar.com' },
      { protocol: 'https', hostname: '*.oceanbazar.com.bd' },
      { protocol: 'https', hostname: '*.elb.amazonaws.com' },
      { protocol: 'https', hostname: '*.cloudfront.net' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
    ...(!isStaticExport
      ? {
          formats: ['image/avif', 'image/webp'],
          minimumCacheTTL: 3600,
        }
      : {}),
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },
  ...(isStaticExport
    ? {}
    : {
        async headers() {
          const cspHeader = getCspHeaderPair();
          const securityHeaders = [
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
            cspHeader,
          ];
          return [
            {
              source: '/:path*',
              headers: securityHeaders,
            },
            {
              source: '/_next/static/:path*',
              headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
            },
            {
              source: '/:path*(\\.ico|\\.png|\\.jpg|\\.jpeg|\\.svg|\\.webp|\\.avif|\\.woff2?|\\.ttf)',
              headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
            },
            {
              source: '/sw.js',
              headers: [
                { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
                { key: 'Service-Worker-Allowed', value: '/' },
              ],
            },
            {
              source: '/sitemap.xml',
              headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }],
            },
          ];
        },
      }),
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.ignoreWarnings = [
        ...(config.ignoreWarnings ?? []),
        {
          module: /@prisma\/instrumentation/,
          message: /Critical dependency: the request of a dependency is an expression/,
        },
      ];
    }
    return config;
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-accordion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      'framer-motion',
      'date-fns',
    ],
  },
};

const intlConfig = withNextIntl(nextConfig);

const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG || 'local',
  project: process.env.SENTRY_PROJECT || 'oceanbazar-web',
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
  widenClientFileUpload: true,
  dryRun: !process.env.SENTRY_AUTH_TOKEN,
};

export default process.env.NEXT_PUBLIC_SENTRY_DSN && !isStaticExport
  ? withSentryConfig(intlConfig, sentryWebpackPluginOptions)
  : intlConfig;
