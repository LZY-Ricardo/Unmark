import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { ClarityInit } from '@/components/ClarityInit'
import { PostHogInit } from '@/components/PostHogInit'
import './globals.css'

export const metadata: Metadata = {
  title: 'Unmark - 抖音/小红书/快手无水印解析',
  description: '输入抖音、小红书或快手链接，一键解析下载无水印视频和图集',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <ClarityInit />
        <PostHogInit />
        <Analytics />
      </body>
    </html>
  )
}
