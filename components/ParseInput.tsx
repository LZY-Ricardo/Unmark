'use client';

import { useCallback, useEffect, useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { useParseStore } from '@/stores/parseStore';
import { useBillingStore } from '@/stores/billingStore';
import { extractSupportedUrl, isValidSupportedUrl } from '@/lib/utils';

export function ParseInput() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const { isLoading, parseUrl, reset } = useParseStore();
  const { entitlement, fetchEntitlement, openPaywall } = useBillingStore();

  useEffect(() => {
    void fetchEntitlement();
  }, [fetchEntitlement]);

  const validateUrl = useCallback((value: string) => {
    if (!value.trim()) {
      return '请输入抖音、小红书或快手链接';
    }
    if (!isValidSupportedUrl(value)) {
      return '请输入有效的抖音、小红书或快手链接';
    }
    return '';
  }, []);

  const handleSubmit = async () => {
    const extractedUrl = extractSupportedUrl(url);
    const validationError = validateUrl(extractedUrl);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    await parseUrl(extractedUrl);
    void fetchEntitlement();
  };

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const extractedUrl = extractSupportedUrl(text);
      setUrl(extractedUrl);

      const validationError = validateUrl(extractedUrl);
      setError(validationError);
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  }, [validateUrl]);

  const handleClear = () => {
    setUrl('');
    setError('');
    reset();
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="glass-panel-strong rounded-3xl p-4 md:p-5 border border-border/80 shadow-[0_12px_28px_-22px_rgba(10,34,66,0.45)]">
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
          <span className="px-3 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">抖音</span>
          <span className="px-3 py-1 rounded-full bg-[#ff6a0012] text-[#d66a13] border border-[#ff6a0028]">小红书</span>
          <span className="px-3 py-1 rounded-full bg-[#16a34a14] text-[#15803d] border border-[#16a34a2a]">快手</span>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-text-secondary">
              今日免费剩余 {entitlement ? entitlement.freeRemaining : '--'} 次
            </span>
            <button
              className="rounded-full border border-border/80 bg-white px-3 py-1 text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
              type="button"
              onClick={() => void openPaywall()}
            >
              查看套餐
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <Input
              type="text"
              value={url}
              onChange={(e) => {
                const extractedUrl = extractSupportedUrl(e.target.value);
                setUrl(extractedUrl);
                if (error) {
                  setError('');
                }
              }}
              placeholder="粘贴抖音、小红书或快手分享链接（支持从整段分享文案自动提取）"
              error={error}
              disabled={isLoading}
              className="h-12"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  void handleSubmit();
                }
              }}
            />
          </div>
          <Button
            onClick={() => void handleSubmit()}
            isLoading={isLoading}
            disabled={isLoading}
            className="md:px-8 min-w-[128px]"
          >
            {isLoading ? '解析中...' : '立即解析'}
          </Button>
        </div>

        <div className="flex items-center gap-3 mt-4 px-1">
          <button
            onClick={() => void handlePaste()}
            className="text-sm text-text-secondary hover:text-accent transition-colors"
            disabled={isLoading}
            type="button"
          >
            粘贴剪贴板
          </button>
          {url && (
            <>
              <span className="text-text-secondary/60">|</span>
              <button
                onClick={handleClear}
                className="text-sm text-text-secondary hover:text-error transition-colors"
                disabled={isLoading}
                type="button"
              >
                清空
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
