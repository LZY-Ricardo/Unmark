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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

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

  return (
    <Card variant="elevated" className="max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">{result.title}</CardTitle>
          <span className="text-sm text-text-secondary">
            共 {result.images.length} 张图片
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* 作者信息 */}
          <div className="flex items-center space-x-3">
            <img
              src={result.author.avatar}
              alt={result.author.name}
              className="w-10 h-10 rounded-full"
            />
            <span className="text-sm text-text-secondary">
              {result.author.name}
            </span>
          </div>

          {/* 图片网格 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {result.images.map((imageUrl, index) => (
              <div
                key={index}
                className="relative group rounded-lg overflow-hidden bg-gray-100 aspect-square cursor-pointer"
                onClick={() => setSelectedImage(imageUrl)}
              >
                <img
                  src={imageUrl}
                  alt={`图片 ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Button
                    size="sm"
                    variant="primary"
                    isLoading={downloadingIndex === index}
                    disabled={downloadingIndex !== null}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadSingle(imageUrl, index);
                    }}
                  >
                    {downloadingIndex === index ? '下载中...' : '保存'}
                  </Button>
                </div>
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
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
            className="w-full"
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

          <p className="text-xs text-text-secondary text-center">
            点击单张图片查看大图，或使用"一键下载全部"保存所有图片
          </p>
        </div>
      </CardContent>

      {/* 图片预览模态框 */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="预览"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Card>
  );
}
