import { Toaster } from '@/components/ui/Toast';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen text-text-primary soft-grid-bg">
      {/* 顶部导航栏 */}
      <nav className="sticky top-0 z-40 border-b border-border/70 bg-white/75 backdrop-blur-md">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-[#52a7ff] flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-lg leading-none">U</span>
              </div>
              <div className="leading-tight">
                <span className="block font-semibold text-lg text-primary">Unmark</span>
                <span className="block text-[11px] text-text-secondary">No Watermark Toolkit</span>
              </div>
            </div>

            {/* 标题（居中） */}
            <h1 className="hidden md:block text-sm font-medium text-text-secondary">
              抖音 / 小红书 无水印解析
            </h1>

            {/* 登录按钮（二期功能） */}
            <button className="px-4 py-2 rounded-full text-sm text-text-secondary border border-border bg-white/60 hover:text-primary hover:border-accent/40 transition-colors">
              登录（即将支持）
            </button>
          </div>
        </div>
      </nav>

      {/* 主内容区域 */}
      {children}

      {/* Toast 通知 */}
      <Toaster />
    </div>
  )
}
