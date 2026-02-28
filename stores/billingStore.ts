import { create } from 'zustand';
import { withClientAnonHeader } from '@/lib/billing/clientIdentity';
import type { BillingSnapshot, PaidPlanType, PaywallDetails } from '@/types/billing';

interface BillingStore {
  isPaywallOpen: boolean;
  isLoading: boolean;
  isPurchasing: boolean;
  entitlement: BillingSnapshot | null;
  paywallDetails: PaywallDetails | null;
  error: string | null;
  fetchEntitlement: () => Promise<void>;
  openPaywall: (details?: PaywallDetails) => Promise<void>;
  closePaywall: () => void;
  purchasePlan: (planType: PaidPlanType) => Promise<{ success: boolean; message?: string }>;
}

function createClientRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export const useBillingStore = create<BillingStore>((set, get) => ({
  isPaywallOpen: false,
  isLoading: false,
  isPurchasing: false,
  entitlement: null,
  paywallDetails: null,
  error: null,

  fetchEntitlement: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/billing/entitlement', {
        method: 'GET',
        headers: withClientAnonHeader(),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        data?: BillingSnapshot;
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error('Failed to fetch entitlement');
      }

      set({
        entitlement: payload.data,
        paywallDetails: {
          variant: payload.data.variant,
          freeDailyLimit: payload.data.freeDailyLimit,
          freeRemaining: payload.data.freeRemaining,
          plans: [
            { type: 'day', priceCents: payload.data.prices.day },
            { type: 'month', priceCents: payload.data.prices.month },
          ],
        },
        isLoading: false,
      });
    } catch (error: unknown) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch entitlement',
      });
    }
  },

  openPaywall: async (details?: PaywallDetails) => {
    set({
      isPaywallOpen: true,
      paywallDetails: details ?? get().paywallDetails,
      error: null,
    });
    await get().fetchEntitlement();
  },

  closePaywall: () => {
    set({ isPaywallOpen: false });
  },

  purchasePlan: async (planType: PaidPlanType) => {
    set({ isPurchasing: true, error: null });

    try {
      const response = await fetch('/api/billing/order', {
        method: 'POST',
        headers: withClientAnonHeader({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          planType,
          clientRequestId: createClientRequestId(),
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: { message?: string } | string;
      };

      if (!response.ok || !payload.success) {
        const fallback = 'Purchase failed';
        const message =
          typeof payload.error === 'string'
            ? payload.error
            : payload.error?.message || fallback;
        throw new Error(message);
      }

      await get().fetchEntitlement();
      set({ isPaywallOpen: false, isPurchasing: false });
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Purchase failed';
      set({
        isPurchasing: false,
        error: message,
      });
      return { success: false, message };
    }
  },
}));
