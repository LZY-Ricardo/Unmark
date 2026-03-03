'use client';

import { VideoResult } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { downloadFile } from '@/lib/utils';

interface VideoCardProps {
  result: VideoResult;
  onDownloadAction?: () => void;
}

export function VideoCard({ result, onDownloadAction }: VideoCardProps) {
  const handleDownload = () => {
    onDownloadAction?.();
    const safeTitle = result.title.replace(/[<>:"/\\|?*]/g, '_').slice(0, 60);
    const filename = `${safeTitle || 'video'}.mp4`;
    downloadFile(result.videoUrl, filename);
  };

  return (
    <Card
      variant="elevated"
      className="max-w-5xl mx-auto border border-border/80 overflow-hidden animate-gallery-enter"
    >
      <CardHeader className="pb-5 border-b border-border/70 gallery-layer gallery-delay-1">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <span className="inline-flex items-center rounded-full border border-accent/25 bg-accent/8 px-3 py-1 text-xs text-accent">
              视频作品
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
              <p className="text-xs text-text-secondary">原画质 · 无水印</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="space-y-5">
          {/* 封面图 */}
          <div className="relative rounded-2xl overflow-hidden bg-[#dbe7f3] border border-white/70 shadow-[0_16px_42px_-28px_rgba(18,34,54,0.5)] gallery-layer gallery-delay-2">
            <img
              src={result.cover}
              alt={result.title}
              className="w-full aspect-video object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-transparent" />
            <div className="absolute bottom-4 left-4 inline-flex items-center rounded-full bg-black/55 px-3 py-1 text-xs text-white">
              可直接下载无水印视频
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 gallery-layer gallery-delay-3">
            <Button
              onClick={handleDownload}
              variant="primary"
              size="lg"
              className="flex-1"
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
              下载视频（无水印）
            </Button>
            <Button
              onClick={() => window.open(result.videoUrl, '_blank', 'noopener,noreferrer')}
              variant="secondary"
              size="lg"
              className="sm:w-[180px]"
            >
              打开原始链接
            </Button>
          </div>

          <p className="text-xs text-text-secondary text-center gallery-layer gallery-delay-4">
            建议先下载再进行二次编辑，避免平台临时链接过期
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
