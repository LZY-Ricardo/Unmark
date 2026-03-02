/** @type {import('next').NextConfig} */
const posthogHost = (process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com')
  .replace(/\/+$/, '');

const posthogAssetsHost = posthogHost.includes('eu.i.posthog.com')
  ? 'https://eu-assets.i.posthog.com'
  : posthogHost.includes('us.i.posthog.com')
    ? 'https://us-assets.i.posthog.com'
    : posthogHost;

const nextConfig = {
  // 启用 standalone 输出用于 Docker 部署
  output: 'standalone',

  // 图片优化配置
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // 生产环境优化
  compress: true,

  // 实验性功能
  experimental: {
    // 优化包导入
    optimizePackageImports: ['zustand'],
  },

  async rewrites() {
    return [
      {
        source: '/ph/static/:path*',
        destination: `${posthogAssetsHost}/static/:path*`,
      },
      {
        source: '/ph/:path*',
        destination: `${posthogHost}/:path*`,
      },
    ];
  },
}

module.exports = nextConfig
