'use client';

import { useMemo } from 'react';
import { useBillingStore } from '@/stores/billingStore';
import { useToastStore } from '@/stores/toastStore';
import type { PaidPlanType } from '@/types/billing';

function formatCny(cents: number): string {
  return `¥${(cents / 100).toFixed(1).replace(/\\.0$/, '')}`;
}

export function PaywallModal() {
  const {
    isPaywallOpen,
    isLoading,
    isPurchasing,
    paywallDetails,
    closePaywall,
    purchasePlan,
  } = useBillingStore();
  const addToast = useToastStore((state) => state.addToast);

  const planMap = useMemo(() => {
    const plans = paywallDetails?.plans ?? [];
    const day = plans.find((item) => item.type === 'day');
    const month = plans.find((item) => item.type === 'month');
    return { day, month };
  }, [paywallDetails]);

  if (!isPaywallOpen) {
    return null;
  }

  const handlePurchase = async (planType: PaidPlanType) => {
    const result = await purchasePlan(planType);
    if (result.success) {
      addToast('开通成功，可继续使用', 'success');
      return;
    }
    addToast(result.message || '支付失败，请重试', 'error');
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-white shadow-[0_20px_40px_-24px_rgba(15,34,56,0.7)]">
        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-primary">今日免费次数已用完</h3>
            <p className="mt-1 text-sm text-text-secondary">
              开通日卡继续使用，常用建议月卡更省
            </p>
          </div>
          <button
            className="rounded-md p-1 text-text-secondary hover:bg-gray-100"
            onClick={closePaywall}
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-sm text-text-secondary">
            每日免费 {paywallDetails?.freeDailyLimit ?? 1} 次，当前剩余 {paywallDetails?.freeRemaining ?? 0} 次
          </div>

          <button
            className="w-full rounded-xl border border-border/80 bg-white px-4 py-3 text-left hover:border-accent/40"
            onClick={() => handlePurchase('day')}
            disabled={isLoading || isPurchasing || !planMap.day}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-primary">日卡（24小时）</div>
                <div className="text-xs text-text-secondary">适合临时高频使用</div>
              </div>
              <div className="text-base font-semibold text-primary">
                {planMap.day ? formatCny(planMap.day.priceCents) : '--'}
              </div>
            </div>
          </button>

          <button
            className="w-full rounded-xl border border-accent/40 bg-accent/5 px-4 py-3 text-left hover:border-accent/60"
            onClick={() => handlePurchase('month')}
            disabled={isLoading || isPurchasing || !planMap.month}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-primary">月卡（30天）</div>
                <div className="text-xs text-text-secondary">不限次 + 优先队列，更划算</div>
              </div>
              <div className="text-base font-semibold text-primary">
                {planMap.month ? formatCny(planMap.month.priceCents) : '--'}
              </div>
            </div>
          </button>

          <button
            onClick={closePaywall}
            className="w-full rounded-lg border border-border/70 px-3 py-2 text-sm text-text-secondary hover:bg-gray-50"
          >
            明天再来（再送 1 次免费）
          </button>
        </div>
      </div>
    </div>
  );
}
