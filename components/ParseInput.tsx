'use client';

import { useState, useCallback } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { useParseStore } from '@/stores/parseStore';
import { isValidDouyinUrl, extractDouyinUrl } from '@/lib/utils';

export function ParseInput() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const { isLoading, parseUrl, reset } = useParseStore();

  const validateUrl = useCallback((value: string) => {
    if (!value.trim()) {
      return '请输入抖音链接';
    }
    if (!isValidDouyinUrl(value)) {
      return '请输入有效的抖音链接';
    }
    return '';
  }, []);

  const handleSubmit = async () => {
    // 自动提取URL（支持粘贴完整分享口令）
    const extractedUrl = extractDouyinUrl(url);

    const validationError = validateUrl(extractedUrl);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    await parseUrl(extractedUrl);
  };

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      // 自动从分享口令中提取URL
      const extractedUrl = extractDouyinUrl(text);
      setUrl(extractedUrl);

      const validationError = validateUrl(extractedUrl);
      if (validationError) {
        setError(validationError);
      } else {
        setError('');
      }
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
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            type="text"
            value={url}
            onChange={(e) => {
              const value = e.target.value;
              // 自动提取URL（支持粘贴完整分享口令）
              const extractedUrl = extractDouyinUrl(value);
              setUrl(extractedUrl);
              if (error) setError('');
            }}
            placeholder="粘贴抖音分享链接或完整分享口令（如：2.07 复制打开抖音... https://v.douyin.com/xxxxx/ ...）"
            error={error}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isLoading) {
                handleSubmit();
              }
            }}
          />
        </div>
        <Button
          onClick={handleSubmit}
          isLoading={isLoading}
          disabled={isLoading}
          className="px-8"
        >
          {isLoading ? '解析中...' : '立即解析'}
        </Button>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={handlePaste}
          className="text-sm text-text-secondary hover:text-accent transition-colors"
          disabled={isLoading}
        >
          📋 粘贴链接
        </button>
        {url && (
          <>
            <span className="text-text-secondary">•</span>
            <button
              onClick={handleClear}
              className="text-sm text-text-secondary hover:text-error transition-colors"
              disabled={isLoading}
            >
              🗑️ 清空
            </button>
          </>
        )}
      </div>
    </div>
  );
}
