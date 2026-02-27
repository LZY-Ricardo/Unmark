import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Unmark - 抖音去水印解析',
  description: '输入抖音链接，一键解析下载无水印视频和图集',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
