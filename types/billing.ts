export type BillingPlanType = 'free' | 'day' | 'month';
export type PaidPlanType = 'day' | 'month';
export type BillingVariant = 'A' | 'B';
export type BillingPayChannel = 'mock' | 'alipay' | 'wechat';
export type BillingPayScene = 'h5' | 'web' | 'qr';
export type BillingOrderStatus =
  | 'created'
  | 'paying'
  | 'paid'
  | 'fulfilled'
  | 'failed'
  | 'refunded';

export interface BillingPlanPrice {
  type: PaidPlanType;
  priceCents: number;
}

export interface BillingEntitlementRecord {
  id: string;
  userId: number;
  planType: PaidPlanType;
  startsAt: string;
  endsAt: string;
  status: 'active' | 'expired' | 'revoked';
  sourceOrderNo?: string;
}

export interface BillingOrderRecord {
  orderNo: string;
  userId: number;
  planType: PaidPlanType;
  amountCents: number;
  currency: 'CNY';
  status: BillingOrderStatus;
  variant: BillingVariant;
  experimentId: string;
  payChannel: BillingPayChannel;
  clientRequestId: string;
  transactionId?: string;
  createdAt: string;
  paidAt?: string;
  fulfilledAt?: string;
}

export interface BillingSnapshot {
  variant: BillingVariant;
  activePlan: BillingPlanType;
  freeDailyLimit: number;
  freeRemaining: number;
  fairUseSoftCap: number;
  prices: {
    day: number;
    month: number;
  };
  currentEntitlement: BillingEntitlementRecord | null;
}

export interface PaywallDetails {
  variant: BillingVariant;
  freeDailyLimit: number;
  freeRemaining: number;
  plans: BillingPlanPrice[];
}
