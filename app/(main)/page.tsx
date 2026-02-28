'use client';

import { ParseInput } from '@/components/ParseInput';
import { VideoCard } from '@/components/VideoCard';
import { ImageGrid } from '@/components/ImageGrid';
import { useParseStore } from '@/stores/parseStore';
import { useToastStore } from '@/stores/toastStore';
import { useEffect } from 'react';

export default function HomePage() {
  const { result, error } = useParseStore();
  const addToast = useToastStore((state) => state.addToast);

  // 显示错误提示
  useEffect(() => {
    if (error) {
      addToast(error, 'error');
    }
  }, [error, addToast]);

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero 区域 */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4">
              输入抖音或小红书链接
              <span className="text-accent">一键解析下载</span>
            </h1>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">
              简单快速，去除水印。支持视频和图集，保持原始画质，让内容创作更轻松。
            </p>
          </div>

          {/* 解析输入区域 */}
          <div className="mb-8">
            <ParseInput />
          </div>

          {/* 解析结果展示 */}
          {result && (
            <div className="mt-12 animate-fade-in">
              {result.type === 'video' ? (
                <VideoCard result={result} />
              ) : (
                <ImageGrid result={result} />
              )}
            </div>
          )}

          {/* 特性展示 */}
          {!result && (
            <div className="grid md:grid-cols-3 gap-6 mt-16">
              <div className="text-center">
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-primary mb-2">快速解析</h3>
                <p className="text-sm text-text-secondary">秒级响应，即时获取无水印内容</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-primary mb-2">高清画质</h3>
                <p className="text-sm text-text-secondary">保持原始画质，无水印下载</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-primary mb-2">安全可靠</h3>
                <p className="text-sm text-text-secondary">不存储数据，保护用户隐私</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
