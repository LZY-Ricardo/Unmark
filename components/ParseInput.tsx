'use client';

import { useState, useCallback } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { useParseStore } from '@/stores/parseStore';
import { isValidDouyinUrl } from '@/lib/utils';

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
    const validationError = validateUrl(url);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    await parseUrl(url);
  };

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      const validationError = validateUrl(text);
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
              setUrl(e.target.value);
              if (error) setError('');
            }}
            placeholder="粘贴抖音分享链接（如：https://v.douyin.com/xxxxx/）"
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
