'use client';

import { useEffect } from 'react';
import { ParseInput } from '@/components/ParseInput';
import { VideoCard } from '@/components/VideoCard';
import { ImageGrid } from '@/components/ImageGrid';
import { SponsorModal } from '@/components/SponsorModal';
import { Button } from '@/components/ui/Button';
import { useSponsorPrompt } from '@/hooks/useSponsorPrompt';
import { useParseStore } from '@/stores/parseStore';
import { useToastStore } from '@/stores/toastStore';

export default function HomePage() {
  const { result, error } = useParseStore();
  const addToast = useToastStore((state) => state.addToast);
  const {
    isOpen,
    triggerSource,
    openManualPrompt,
    closeModal,
    recordSponsorClick,
    handleParseAction,
    handleDownloadAction,
  } = useSponsorPrompt();

  useEffect(() => {
    if (error) {
      addToast(error, 'error');
    }
  }, [error, addToast]);

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-[#88d6ff]/40 blur-3xl" />
        <div className="absolute top-8 right-0 w-64 h-64 rounded-full bg-[#ffd5ac]/45 blur-3xl" />
      </div>

      <div className="container relative mx-auto px-4 py-10 md:py-14">
        <div className="max-w-5xl mx-auto">
          <section className="text-center mb-10 md:mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-white/75 px-4 py-1.5 text-xs text-text-secondary mb-5">
              <span className="w-2 h-2 rounded-full bg-accent" />
              新版解析流已支持抖音 + 小红书 + 快手
            </div>

            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-primary">
              输入分享链接
              <span className="block mt-2 bg-gradient-to-r from-accent to-[#ff8a3d] bg-clip-text text-transparent">
                一键获取无水印内容
              </span>
            </h1>

            <p className="mt-5 text-base md:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
              支持视频与图集解析，自动提取分享文案中的链接。下载即原图原清晰度，减少手动处理步骤。
            </p>
          </section>

          <section className="mb-8 md:mb-10">
            <ParseInput onParseAction={handleParseAction} />
            <div className="mt-5 relative flex flex-col items-center gap-2 text-center">
              <div className="pointer-events-none absolute -top-3 h-14 w-56 rounded-full bg-[#ff7a3a]/30 blur-2xl" />
              <Button
                type="button"
                variant="primary"
                size="md"
                className="group relative min-w-[180px] border border-[#ff9a6426] bg-gradient-to-r from-[#ff8a3d] via-[#ff6b52] to-[#ff4d6d] text-white shadow-[0_16px_34px_-16px_rgba(255,108,76,0.9)] animate-sponsor-pulse hover:scale-[1.03] hover:shadow-[0_20px_40px_-16px_rgba(255,88,88,0.95)]"
                onClick={openManualPrompt}
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8.5l1.8 3.65 4.03.58-2.91 2.84.69 4.01L12 17.7l-3.61 1.88.69-4.01-2.91-2.84 4.03-.58L12 8.5z" />
                </svg>
                赞助支持
                <span className="absolute -top-2 -right-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#ff5c4a] shadow-[0_8px_18px_-12px_rgba(255,92,74,0.9)]">
                  免费维护中
                </span>
              </Button>
              <p className="text-xs font-medium text-[#8a4a32]">喜欢这个工具的话，欢迎支持服务器和带宽成本</p>
            </div>
          </section>

          {result && (
            <section className="mt-10 animate-gallery-enter">
              {result.type === 'video' ? (
                <VideoCard result={result} onDownloadAction={handleDownloadAction} />
              ) : (
                <ImageGrid result={result} onDownloadAction={handleDownloadAction} />
              )}
            </section>
          )}

          {!result && (
            <section className="grid md:grid-cols-3 gap-4 md:gap-5 mt-12">
              <article className="glass-panel rounded-2xl p-5">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-primary mb-1.5">解析速度</h3>
                <p className="text-sm text-text-secondary">优先无 Cookie 流程，通常在几秒内返回结果。</p>
              </article>

              <article className="glass-panel rounded-2xl p-5">
                <div className="w-10 h-10 rounded-xl bg-[#ff7a0012] text-[#d66a13] flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-primary mb-1.5">清晰度保真</h3>
                <p className="text-sm text-text-secondary">图集直接抓取原始图链，视频自动处理水印参数。</p>
              </article>

              <article className="glass-panel rounded-2xl p-5">
                <div className="w-10 h-10 rounded-xl bg-[#0ea86e14] text-[#0f8b62] flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-primary mb-1.5">流程轻量</h3>
                <p className="text-sm text-text-secondary">无需登录扫码，不做长期缓存，打开即用。</p>
              </article>
            </section>
          )}
        </div>
      </div>

      <SponsorModal
        isOpen={isOpen}
        source={triggerSource}
        onClose={closeModal}
        onSponsorClick={recordSponsorClick}
      />
    </main>
  );
}
