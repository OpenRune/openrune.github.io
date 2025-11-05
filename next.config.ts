import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    position: 'top-right',
  },
  async rewrites() {
    // Use cache-proxy route for dynamic cache type routing
    // Route handlers (like /api/share) take precedence over rewrites
    return [
      {
        source: '/api/:path*',
        destination: '/api/cache-proxy/:path*',
      },
    ];
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: process.env.NODE_ENV === 'development' ? 0 : 31536000, // No cache in dev, 1 year in prod
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Output optimization
  output: 'standalone',
  
  // Experimental optimizations
  experimental: {
    optimizeCss: {
      inlineFonts: true,
      preloadFonts: true,
      fonts: true,
      keyframes: 'critical',
      compress: true,
      external: true,
      inlineThreshold: 4096, // Inline stylesheets smaller than 4KB
      minimumExternalSize: 2048, // If non-critical stylesheet < 2KB, inline it
      pruneSource: true, // Remove inlined rules from external stylesheet
      mergeStylesheets: true, // Merge inlined stylesheets into single <style> tag
      reduceInlineStyles: true, // Evaluate inline styles for critical CSS
      preload: 'swap', // Font preload strategy
      noscriptFallback: true, // Add <noscript> fallback
      logLevel: 'warn',
    } as any,
    optimizePackageImports: [
      '@tabler/icons-react',
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-context-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
    ],
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  
  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        minimize: true,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            framework: {
              name: 'framework',
              chunks: 'all',
              test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
              priority: 40,
              enforce: true,
            },
            lib: {
              test: /[\\/]node_modules[\\/]/,
              name(module: any) {
                const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)?.[1];
                return `lib-${packageName?.replace('@', '')}`;
              },
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },
            commons: {
              name: 'commons',
              minChunks: 2,
              priority: 20,
            },
            shared: {
              name(module: any, chunks: any) {
                return 'shared';
              },
              priority: 10,
              minChunks: 2,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    
    // SVG optimization
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    
    return config;
  },
  
  // Headers for better caching
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: isDev 
              ? 'no-cache, no-store, must-revalidate, max-age=0'
              : 'public, s-maxage=60, stale-while-revalidate=300',
          },
          ...(isDev ? [
            {
              key: 'Pragma',
              value: 'no-cache'
            },
            {
              key: 'Expires',
              value: '0'
            }
          ] : [])
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: isDev 
              ? 'no-cache, no-store, must-revalidate, max-age=0'
              : 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/updates/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: isDev 
              ? 'no-cache, no-store, must-revalidate, max-age=0'
              : 'public, max-age=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
