/** @type {import('next').NextConfig} */
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
}

module.exports = nextConfig
