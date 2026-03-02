import { create } from 'zustand';
import { track } from '@vercel/analytics';
import type { ParseResult } from '@/types';

interface ParseStore {
  // 解析状态
  isLoading: boolean;
  result: ParseResult | null;
  error: string | null;

  // 操作方法
  parseUrl: (url: string) => Promise<void>;
  reset: () => void;
  setError: (error: string) => void;
}

type SupportedPlatform = 'douyin' | 'tiktok' | 'kuaishou' | 'xiaohongshu' | 'bilibili' | 'unknown';
type ParseMode = 'backend' | 'no-cookie' | 'unknown';
type FailReason = 'invalid_input' | 'parse_rejected' | 'upstream_unavailable' | 'timeout' | 'unknown';

interface ParseApiResponse {
  success?: boolean;
  data?: ParseResult;
  error?: string;
  mode?: 'backend' | 'no-cookie';
  platform?: string;
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function detectPlatformByUrl(url: string): SupportedPlatform {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('douyin.com') || lowerUrl.includes('v.douyin.com')) return 'douyin';
  if (lowerUrl.includes('tiktok.com') || lowerUrl.includes('vm.tiktok.com')) return 'tiktok';
  if (
    lowerUrl.includes('kuaishou.com') ||
    lowerUrl.includes('v.kuaishou.com') ||
    lowerUrl.includes('kuaishou.cn') ||
    lowerUrl.includes('live.kuaishou.com')
  ) {
    return 'kuaishou';
  }
  if (lowerUrl.includes('xiaohongshu.com') || lowerUrl.includes('xhslink.com')) return 'xiaohongshu';
  if (lowerUrl.includes('bilibili.com') || lowerUrl.includes('b23.tv')) return 'bilibili';

  return 'unknown';
}

function toSupportedPlatform(value?: string): SupportedPlatform {
  switch ((value || '').toLowerCase()) {
    case 'douyin':
      return 'douyin';
    case 'tiktok':
      return 'tiktok';
    case 'kuaishou':
      return 'kuaishou';
    case 'xiaohongshu':
      return 'xiaohongshu';
    case 'bilibili':
      return 'bilibili';
    default:
      return 'unknown';
  }
}

function mapFailReason(message: string, statusCode?: number): FailReason {
  const lower = message.toLowerCase();

  if (
    statusCode === 400 ||
    lower.includes('请输入') ||
    lower.includes('请提供链接') ||
    lower.includes('有效') ||
    lower.includes('暂不支持')
  ) {
    return 'invalid_input';
  }

  if (
    statusCode === 422 ||
    lower.includes('无法从') ||
    lower.includes('未提取到') ||
    lower.includes('提取') ||
    lower.includes('仅支持在小红书 app')
  ) {
    return 'parse_rejected';
  }

  if (
    statusCode === 503 ||
    lower.includes('后端api错误') ||
    lower.includes('快手后端api错误') ||
    lower.includes('fetch failed') ||
    lower.includes('econnrefused')
  ) {
    return 'upstream_unavailable';
  }

  if (lower.includes('timeout') || lower.includes('超时')) {
    return 'timeout';
  }

  return 'unknown';
}

function safeTrack(
  eventName: string,
  properties: Record<string, string | number | boolean | null | undefined>
): void {
  try {
    track(eventName, properties);
  } catch {
    // Ignore analytics failures, never block parsing flow.
  }
}

export const useParseStore = create<ParseStore>((set) => ({
  // 初始状态
  isLoading: false,
  result: null,
  error: null,

  // 解析链接
  parseUrl: async (url: string) => {
    const startAt = nowMs();
    const platform = detectPlatformByUrl(url);
    let statusCode: number | undefined;

    set({ isLoading: true, error: null });
    safeTrack('parse_submit', { platform });

    try {
      // 统一解析入口（自动识别平台）
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      statusCode = response.status;
      const data = (await response.json()) as ParseApiResponse;

      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.error || '解析失败');
      }

      const durationMs = Math.max(0, Math.round(nowMs() - startAt));
      const parsedPlatform = toSupportedPlatform(data.platform);
      const trackedPlatform = parsedPlatform === 'unknown' ? platform : parsedPlatform;
      const mode: ParseMode = data.mode || 'unknown';

      safeTrack('parse_success', {
        platform: trackedPlatform,
        result_type: data.data.type,
        mode,
        duration_ms: durationMs,
        status_code: statusCode,
      });

      set({ result: data.data, isLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '解析失败，请稍后重试';
      const durationMs = Math.max(0, Math.round(nowMs() - startAt));
      const failReason = mapFailReason(message, statusCode);

      safeTrack('parse_fail', {
        platform,
        fail_reason: failReason,
        duration_ms: durationMs,
        status_code: statusCode ?? null,
      });

      set({
        error: message,
        isLoading: false,
      });
    }
  },

  // 重置状态
  reset: () => {
    set({ result: null, error: null, isLoading: false });
  },

  // 设置错误
  setError: (error: string) => {
    set({ error });
  },
}));
