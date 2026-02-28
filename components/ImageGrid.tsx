'use client';

import { ImagesResult } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { useState } from 'react';
import { downloadImage } from '@/lib/utils';

interface ImageGridProps {
  result: ImagesResult;
}

export function ImageGrid({ result }: ImageGridProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const activeImage = result.images[activeIndex] || result.cover || result.images[0] || '';

  const handleDownloadSingle = async (imageUrl: string, index: number) => {
    setDownloadingIndex(index);
    try {
      await downloadImage(imageUrl, result.title || 'douyin_images', index);
    } catch (error) {
      console.error('下载失败:', error);
      // 降级：在新标签页打开
      window.open(imageUrl, '_blank');
    } finally {
      setDownloadingIndex(null);
    }
  };

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    setDownloadProgress(0);

    try {
      for (let i = 0; i < result.images.length; i++) {
        await handleDownloadSingle(result.images[i], i);
        setDownloadProgress(i + 1);
        // 每张图片间隔 300ms，避免浏览器阻止多个下载
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error('批量下载失败:', error);
    } finally {
      setDownloadingAll(false);
      setDownloadProgress(0);
    }
  };

  const openPreview = (index: number) => {
    setPreviewIndex(index);
  };

  const closePreview = () => {
    setPreviewIndex(null);
  };

  const showPrevPreview = () => {
    if (previewIndex === null || result.images.length === 0) {
      return;
    }
    setPreviewIndex((previewIndex - 1 + result.images.length) % result.images.length);
  };

  const showNextPreview = () => {
    if (previewIndex === null || result.images.length === 0) {
      return;
    }
    setPreviewIndex((previewIndex + 1) % result.images.length);
  };

  return (
    <Card
      variant="elevated"
      className="max-w-5xl mx-auto border border-border/80 overflow-hidden animate-gallery-enter"
    >
      <CardHeader className="pb-5 border-b border-border/70 gallery-layer gallery-delay-1">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <span className="inline-flex items-center rounded-full border border-[#ff7a002f] bg-[#ff7a0011] px-3 py-1 text-xs text-[#d66a13]">
              图集作品
            </span>
            <CardTitle className="text-xl md:text-2xl leading-snug">
              {result.title}
            </CardTitle>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-white/75 px-3 py-2">
            <img
              src={result.author.avatar}
              alt={result.author.name}
              className="w-10 h-10 rounded-full ring-2 ring-white"
            />
            <div className="leading-tight">
              <p className="text-sm font-medium text-primary">{result.author.name}</p>
              <p className="text-xs text-text-secondary">共 {result.images.length} 张 · 原图链</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="space-y-6">
          {/* 主预览区域 */}
          <div className="relative rounded-2xl overflow-hidden bg-[#dbe7f3] border border-white/70 shadow-[0_16px_42px_-28px_rgba(18,34,54,0.5)] gallery-layer gallery-delay-2">
            <img
              src={activeImage}
              alt={`主预览 ${activeIndex + 1}`}
              className="w-full aspect-video object-cover"
              onClick={() => openPreview(activeIndex)}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
              <span className="inline-flex items-center rounded-full bg-black/55 px-3 py-1 text-xs text-white">
                第 {activeIndex + 1} 张 / 共 {result.images.length} 张
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPreview(activeIndex);
                  }}
                  className="bg-white/92"
                >
                  查看大图
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  isLoading={downloadingIndex === activeIndex}
                  disabled={downloadingIndex !== null || !activeImage}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadSingle(activeImage, activeIndex);
                  }}
                >
                  下载当前
                </Button>
              </div>
            </div>
          </div>

          {/* 图片缩略图 */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 gallery-layer gallery-delay-3">
            {result.images.map((imageUrl, index) => (
              <div
                key={index}
                className={`relative group rounded-xl overflow-hidden aspect-square cursor-pointer border transition-all ${
                  activeIndex === index
                    ? 'border-accent shadow-[0_10px_20px_-14px_rgba(11,123,255,0.9)]'
                    : 'border-border/70 hover:border-accent/45'
                }`}
                onClick={() => setActiveIndex(index)}
              >
                <img
                  src={imageUrl}
                  alt={`图片 ${index + 1}`}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                />
                <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>

          {/* 一键下载全部 */}
          <Button
            onClick={handleDownloadAll}
            isLoading={downloadingAll}
            disabled={downloadingAll || downloadingIndex !== null}
            variant="primary"
            size="lg"
            className="w-full gallery-layer gallery-delay-4"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {downloadingAll
              ? `下载中 (${downloadProgress}/${result.images.length})`
              : '一键下载全部'}
          </Button>

          <p className="text-xs text-text-secondary text-center gallery-layer gallery-delay-4">
            点击缩略图切换主预览，支持单张下载或整组下载
          </p>
        </div>
      </CardContent>

      {/* 图片预览模态框 */}
      {previewIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/88 flex items-center justify-center p-4"
          onClick={closePreview}
        >
          <button
            className="absolute top-4 right-4 text-white/90 hover:text-white"
            onClick={closePreview}
            aria-label="关闭预览"
          >
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <button
            className="absolute left-3 md:left-8 text-white/90 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              showPrevPreview();
            }}
            aria-label="上一张"
          >
            <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <img
            src={result.images[previewIndex]}
            alt="预览"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            className="absolute right-3 md:right-8 text-white/90 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              showNextPreview();
            }}
            aria-label="下一张"
          >
            <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
            {previewIndex + 1} / {result.images.length}
          </div>
        </div>
      )}
    </Card>
  );
}
