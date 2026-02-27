import { Toaster } from '@/components/ui/Toast';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* 顶部导航栏 */}
      <nav className="border-b border-border bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">U</span>
              </div>
              <span className="font-semibold text-xl text-primary">Unmark</span>
            </div>

            {/* 标题（居中） */}
            <h1 className="text-lg font-medium text-text-primary">抖音去水印</h1>

            {/* 登录按钮（二期功能） */}
            <button className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
              登录
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
