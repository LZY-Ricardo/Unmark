import { create } from 'zustand';
import type { ParseResult } from '@/types';
import { withClientAnonHeader } from '@/lib/billing/clientIdentity';
import { useBillingStore } from '@/stores/billingStore';
import type { PaywallDetails } from '@/types/billing';

interface ParseStore {
  isLoading: boolean;
  result: ParseResult | null;
  error: string | null;
  parseUrl: (url: string) => Promise<void>;
  reset: () => void;
  setError: (error: string) => void;
}

interface ParseErrorShape {
  code?: string;
  message?: string;
  details?: unknown;
}

function asParseError(error: unknown): ParseErrorShape {
  if (!error) {
    return {};
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  if (typeof error === 'object') {
    const obj = error as ParseErrorShape;
    return {
      code: typeof obj.code === 'string' ? obj.code : undefined,
      message: typeof obj.message === 'string' ? obj.message : undefined,
      details: obj.details,
    };
  }

  return {};
}

function asPaywallDetails(details: unknown): PaywallDetails | undefined {
  if (!details || typeof details !== 'object') {
    return undefined;
  }

  const obj = details as {
    variant?: string;
    freeDailyLimit?: number;
    freeRemaining?: number;
    plans?: Array<{ type?: string; priceCents?: number }>;
  };

  if (!Array.isArray(obj.plans)) {
    return undefined;
  }

  const plans = obj.plans
    .filter((plan) => plan.type === 'day' || plan.type === 'month')
    .map((plan) => ({
      type: plan.type as 'day' | 'month',
      priceCents: typeof plan.priceCents === 'number' ? plan.priceCents : 0,
    }));

  if (plans.length === 0) {
    return undefined;
  }

  return {
    variant: obj.variant === 'B' ? 'B' : 'A',
    freeDailyLimit: typeof obj.freeDailyLimit === 'number' ? obj.freeDailyLimit : 1,
    freeRemaining: typeof obj.freeRemaining === 'number' ? obj.freeRemaining : 0,
    plans,
  };
}

export const useParseStore = create<ParseStore>((set) => ({
  isLoading: false,
  result: null,
  error: null,

  parseUrl: async (url: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: withClientAnonHeader({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ url }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        data?: ParseResult;
        error?: ParseErrorShape | string;
      };

      if (!response.ok || !payload.success || !payload.data) {
        const parseError = asParseError(payload.error);

        if (parseError.code === 'PAYWALL_REQUIRED') {
          const details = asPaywallDetails(parseError.details);
          await useBillingStore.getState().openPaywall(details);
          set({ isLoading: false });
          return;
        }

        throw new Error(parseError.message || '解析失败');
      }

      set({ result: payload.data, isLoading: false });
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : '解析失败，请稍后重试',
        isLoading: false,
      });
    }
  },

  reset: () => {
    set({ result: null, error: null, isLoading: false });
  },

  setError: (error: string) => {
    set({ error });
  },
}));
