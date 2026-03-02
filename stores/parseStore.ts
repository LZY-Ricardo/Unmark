import { create } from 'zustand';
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
interface ParseApiResponse {
  success?: boolean;
  data?: ParseResult;
  error?: string;
}

export const useParseStore = create<ParseStore>((set) => ({
  // 初始状态
  isLoading: false,
  result: null,
  error: null,

  // 解析链接
  parseUrl: async (url: string) => {
    set({ isLoading: true, error: null });

    try {
      // 统一解析入口（自动识别平台）
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = (await response.json()) as ParseApiResponse;

      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.error || '解析失败');
      }

      set({ result: data.data, isLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '解析失败，请稍后重试';

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
