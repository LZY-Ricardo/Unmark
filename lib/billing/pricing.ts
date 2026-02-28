import { getBillingConfig } from '@/lib/billing/config';
import type { BillingVariant, PaidPlanType } from '@/types/billing';

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function resolveVariant(anonId: string): BillingVariant {
  const config = getBillingConfig();
  const slot = hashString(`${anonId}:${config.experimentId}`) % 100;
  return slot < 50 ? 'A' : 'B';
}

export function getPlanPriceCents(variant: BillingVariant, planType: PaidPlanType): number {
  const config = getBillingConfig();
  return config.prices[variant][planType];
}
