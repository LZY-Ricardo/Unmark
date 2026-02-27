'use client';

import { VideoResult } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { downloadFile } from '@/lib/utils';

interface VideoCardProps {
  result: VideoResult;
}

export function VideoCard({ result }: VideoCardProps) {
  const handleDownload = () => {
    const filename = `${result.title}.mp4`;
    downloadFile(result.videoUrl, filename);
  };

  return (
    <Card variant="elevated" className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl">{result.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 封面图 */}
          <div className="relative rounded-lg overflow-hidden bg-gray-100">
            <img
              src={result.cover}
              alt={result.title}
              className="w-full h-auto"
            />
          </div>

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

          {/* 下载按钮 */}
          <Button
            onClick={handleDownload}
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
            下载视频（无水印）
          </Button>

          <p className="text-xs text-text-secondary text-center">
            点击下载按钮即可保存到本地
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
