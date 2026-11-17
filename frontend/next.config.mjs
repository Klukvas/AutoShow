import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * STOREFRONT_THEME picks the storefront design when the image is BUILT: `@theme/<slot>`
 * resolves to src/themes/<id>/, so an image contains only its client's design and no
 * page has to ask the backend which one to render. Unset means `current`; any value
 * that is not a theme folder fails the build instead of shipping another design.
 */
const themesDir = join(import.meta.dirname, 'src/themes');
const themeIds = readdirSync(themesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const storefrontTheme = process.env.STOREFRONT_THEME ?? 'current';
if (!themeIds.includes(storefrontTheme)) {
  throw new Error(
    `Invalid STOREFRONT_THEME=${JSON.stringify(storefrontTheme)}: expected one of ` +
      `${themeIds.join(', ')} (the folders in frontend/src/themes/), or unset for current.`,
  );
}
const selectedThemeDir = join(themesDir, storefrontTheme);
const themeImport = /^@theme\//;

const isDev = process.env.NODE_ENV !== 'production';
// Match the client validator: malformed or absent IDs leave GA completely off.
const hasGoogleAnalytics = /^G-[A-Z0-9]{10}$/.test(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '');
const analyticsScript = hasGoogleAnalytics ? ' https://www.googletagmanager.com' : '';
const analyticsImages = hasGoogleAnalytics
  ? ' https://www.googletagmanager.com https://*.google-analytics.com'
  : '';
const analyticsConnections = hasGoogleAnalytics
  ? ' https://www.googletagmanager.com https://*.google-analytics.com https://*.google.com'
  : '';
/**
 * NEXT_PUBLIC_MEDIA_HOSTS entries: bare hostname (`media.example.com` → https)
 * or a full origin (`http://157.90.1.2:8081` — the no-domain deploy mode).
 */
const mediaEntries = (process.env.NEXT_PUBLIC_MEDIA_HOSTS?.split(',') ?? [])
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => new URL(entry.includes('://') ? entry : `https://${entry}`));
// Dev media/storage lives on MinIO; prod comes from NEXT_PUBLIC_MEDIA_HOSTS.
const mediaOrigins = [
  ...(isDev ? ['http://localhost:9000'] : []),
  ...mediaEntries.map((u) => u.origin),
];

/**
 * Pragmatic CSP: source allowlists + frame/object hardening. `unsafe-inline`
 * for scripts stays because Next injects inline bootstrap scripts and the
 * theme script runs before hydration; a nonce-based policy needs middleware
 * and is the follow-up step. `unsafe-eval` is dev-only (webpack HMR).
 */
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}${analyticsScript}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: ${mediaOrigins.join(' ')}${analyticsImages}`.trim(),
  // XHR: API calls + direct presigned PUT uploads to object storage.
  `connect-src 'self' ${mediaOrigins.join(' ')}${analyticsConnections}`.trim(),
  `font-src 'self' data:`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-contained server bundle for the Docker image (node server.js).
  output: 'standalone',
  // Pin the tracing root to this app: with sibling lockfiles (backend repo
  // root, $HOME) Next guesses wrong and nests server.js deep inside
  // .next/standalone/<full/path>. Pinned, it is always at the top level.
  outputFileTracingRoot: import.meta.dirname,
  // The single definition of the built theme id for runtime code (src/themes/built-theme.ts).
  env: { STOREFRONT_THEME: storefrontTheme },
  // `@theme/<slot>` -> src/themes/<built theme>/<slot>. Not `resolve.alias`: Next applies
  // the tsconfig `paths` (where @theme is `current`, for tsc and editors) in a resolver
  // plugin that runs before the alias, so an alias would silently build `current`. This
  // plugin rewrites the request before any resolution; webpack's API is to edit it in place.
  // A bundler that skips this hook (Turbopack) resolves `@theme` to `current` again:
  // src/themes/built-theme.ts compares `@theme/id` with the inlined id and fails that build.
  webpack: (config, { webpack }) => ({
    ...config,
    plugins: [
      ...config.plugins,
      new webpack.NormalModuleReplacementPlugin(themeImport, (resource) => {
        resource.request = resource.request.replace(themeImport, `${selectedThemeDir}/`);
      }),
    ],
  }),
  experimental: {
    optimizePackageImports: ['framer-motion', '@studio-freight/lenis'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      // Allow MinIO in dev + production S3/CDN — from NEXT_PUBLIC_MEDIA_HOSTS
      // (bare hostnames or full origins, see mediaEntries above).
      ...mediaEntries.map((u) => ({
        protocol: u.protocol.replace(':', ''),
        hostname: u.hostname,
        ...(u.port ? { port: u.port } : {}),
      })),
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
  async rewrites() {
    // robots.txt / sitemap.xml are generated by the backend (single source of
    // truth, DB-driven sitemap) but crawlers only look at the site root —
    // proxy them through the storefront domain.
    const backend = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3000/api';
    return [
      ...(isDev ? [{ source: '/api/:path*', destination: `${backend}/:path*` }] : []),
      { source: '/robots.txt', destination: `${backend}/robots.txt` },
      { source: '/sitemap.xml', destination: `${backend}/sitemap.xml` },
    ];
  },
};

export default withNextIntl(nextConfig);
