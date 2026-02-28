import { Toaster } from '@/components/ui/Toast';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen text-text-primary soft-grid-bg">
      {/* 顶部导航栏 */}
      <nav className="sticky top-0 z-50">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
        <div className="relative border-b border-border/70 bg-white/78 backdrop-blur-xl">
          <div className="pointer-events-none absolute -left-16 top-0 h-24 w-48 rounded-full bg-[#8fd5ff]/25 blur-2xl" />
          <div className="pointer-events-none absolute -right-10 top-0 h-24 w-44 rounded-full bg-[#ffd9b9]/30 blur-2xl" />
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-[74px]">
              {/* Logo */}
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-accent/50 to-[#6cb5ff]/45 blur-[2px]" />
                  <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-accent to-[#57abff] flex items-center justify-center shadow-[0_10px_20px_-14px_rgba(11,123,255,0.95)]">
                    <span className="text-white font-bold text-[22px] leading-none">U</span>
                  </div>
                </div>
                <div className="leading-tight">
                  <span className="block font-semibold text-[28px] text-primary tracking-tight">Unmark</span>
                  <span className="block text-xs text-text-secondary">No Watermark Toolkit</span>
                </div>
              </div>

              {/* 标题（居中） */}
              <div className="hidden lg:flex items-center gap-2 rounded-full border border-border/80 bg-white/80 px-2.5 py-1.5 shadow-[0_8px_20px_-20px_rgba(15,34,56,0.8)]">
                <span className="inline-flex items-center rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                  抖音
                </span>
                <span className="inline-flex items-center rounded-full border border-[#ff7a0028] bg-[#ff7a0012] px-2 py-0.5 text-[11px] font-medium text-[#d66a13]">
                  小红书
                </span>
                <span className="text-xs text-text-secondary px-1">无水印解析</span>
              </div>

              {/* 登录按钮（二期功能） */}
              <button className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-white/90 px-4 py-2 text-sm font-medium text-primary shadow-[0_8px_18px_-18px_rgba(15,34,56,0.85)] transition-all hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-[0_12px_26px_-18px_rgba(11,123,255,0.65)]">
                <svg className="h-4 w-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a4 4 0 10-8 0v10h8V7zm0 0h2a2 2 0 012 2v8H5V9a2 2 0 012-2h2" />
                </svg>
                <span className="hidden sm:inline">登录（即将支持）</span>
                <span className="sm:hidden">登录</span>
              </button>
            </div>
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
