import type {
  BillingOrderRecord,
  BillingPayChannel,
  BillingPayScene,
} from '@/types/billing';

export type PaymentCreateStatus = 'requires_action' | 'succeeded';
export type PaymentQueryStatus = 'paying' | 'paid' | 'failed';

export interface CreatePaymentInput {
  order: BillingOrderRecord;
  scene?: BillingPayScene;
  returnUrl?: string;
  notifyUrl?: string;
}

export interface CreatePaymentResult {
  payChannel: BillingPayChannel;
  providerOrderNo: string;
  status: PaymentCreateStatus;
  paymentPayload: Record<string, unknown>;
  transactionId?: string;
  expiresAt?: string;
}

export interface PaymentWebhookEvent {
  payChannel: BillingPayChannel;
  orderNo: string;
  transactionId: string;
  eventType: string;
  paidAmountCents?: number;
  currency?: string;
  rawPayload?: unknown;
}

export interface PaymentProvider {
  readonly payChannel: BillingPayChannel;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyWebhook(request: Request): Promise<PaymentWebhookEvent>;
  queryOrder?(
    providerOrderNo: string
  ): Promise<{ status: PaymentQueryStatus; transactionId?: string }>;
}
