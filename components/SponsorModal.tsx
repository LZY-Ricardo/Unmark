'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { SponsorTriggerSource } from '@/hooks/useSponsorPrompt';

interface SponsorModalProps {
  isOpen: boolean;
  source: SponsorTriggerSource;
  onClose: () => void;
  onSponsorClick: () => void;
}

const wechatQrImage = process.env.NEXT_PUBLIC_SPONSOR_QR_WECHAT || '/sponsor/wechat-pay.jpg';
const alipayQrImage = process.env.NEXT_PUBLIC_SPONSOR_QR_ALIPAY || '/sponsor/alipay.jpg';

function sourceLabel(source: SponsorTriggerSource): string {
  switch (source) {
    case 'parse':
      return '你正在使用解析功能';
    case 'download':
      return '你正在下载无水印内容';
    default:
      return '感谢你在使用 Unmark';
  }
}

export function SponsorModal({
  isOpen,
  source,
  onClose,
  onSponsorClick,
}: SponsorModalProps) {
  const [activeMethod, setActiveMethod] = useState<'wechat' | 'alipay'>('wechat');

  if (!isOpen) {
    return null;
  }

  const activeImage = activeMethod === 'wechat' ? wechatQrImage : alipayQrImage;
  const activeLabel = activeMethod === 'wechat' ? '微信收款码' : '支付宝收款码';

  return (
    <div className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-md rounded-3xl border border-border/80 bg-white p-5 md:p-6 shadow-[0_26px_60px_-28px_rgba(15,32,53,0.55)] animate-gallery-enter">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-2 text-text-secondary hover:text-primary hover:bg-[#edf3fb]"
          aria-label="close sponsor modal"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ff8a3d33] bg-[#ff8a3d12] px-3 py-1 text-xs text-[#d66a13]">
            <span className="inline-flex h-2 w-2 rounded-full bg-[#ff8a3d]" />
            赞助支持
          </div>

          <h3 className="text-xl font-semibold text-primary">喜欢这个工具的话，欢迎赞助支持</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            {sourceLabel(source)}。你的支持会用于服务器和带宽成本，帮助项目长期稳定运行。
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveMethod('wechat')}
              className={`h-9 rounded-full border text-sm transition-colors ${
                activeMethod === 'wechat'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border/80 bg-white text-text-secondary hover:text-primary'
              }`}
            >
              微信
            </button>
            <button
              type="button"
              onClick={() => setActiveMethod('alipay')}
              className={`h-9 rounded-full border text-sm transition-colors ${
                activeMethod === 'alipay'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border/80 bg-white text-text-secondary hover:text-primary'
              }`}
            >
              支付宝
            </button>
          </div>

          <div className="rounded-2xl border border-border/80 bg-[#f8fbff] p-3">
            <p className="mb-2 text-center text-sm font-medium text-primary">{activeLabel}</p>
            <img src={activeImage} alt={activeLabel} className="mx-auto h-56 w-56 rounded-xl object-cover" />
          </div>

          <p className="text-center text-xs text-text-secondary">请使用微信或支付宝扫码支持，感谢你的帮助。</p>

          <div className="flex items-center gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              稍后再说
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => {
                onSponsorClick();
                onClose();
              }}
              title="感谢支持"
            >
              我已扫码，感谢支持
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
