import { BillingError } from '@/lib/billing/errors';
import { ErrorCode } from '@/types';
import type {
  BillingOrderRecord,
  BillingPayChannel,
} from '@/types/billing';
import { AlipayPaymentProvider } from '@/lib/billing/payments/providers/alipay';
import { MockPaymentProvider } from '@/lib/billing/payments/providers/mock';
import { WechatPaymentProvider } from '@/lib/billing/payments/providers/wechat';
import type {
  CreatePaymentResult,
  CreatePaymentInput,
  PaymentProvider,
  PaymentWebhookEvent,
} from '@/lib/billing/payments/types';

const providers: Record<BillingPayChannel, PaymentProvider> = {
  mock: new MockPaymentProvider(),
  alipay: new AlipayPaymentProvider(),
  wechat: new WechatPaymentProvider(),
};

function readBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function getEnabledPayChannels(): BillingPayChannel[] {
  const raw = process.env.PAY_ENABLED_CHANNELS || 'mock';
  const channels = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item): item is BillingPayChannel => item in providers);

  return channels.length > 0 ? channels : ['mock'];
}

function getDefaultPayChannel(): BillingPayChannel {
  const raw = (process.env.PAY_PROVIDER_DEFAULT || 'mock').trim();
  if (raw in providers) {
    return raw as BillingPayChannel;
  }
  return 'mock';
}

function isRealPaymentEnabled(): boolean {
  return readBoolean(process.env.PAY_REAL_ENABLED, false);
}

export function isBillingPayChannel(value: string): value is BillingPayChannel {
  return value in providers;
}

export function resolveOrderPayChannel(
  requestedChannel?: BillingPayChannel
): BillingPayChannel {
  const enabled = getEnabledPayChannels();
  const channel = requestedChannel ?? getDefaultPayChannel();

  if (!enabled.includes(channel)) {
    throw new BillingError(
      ErrorCode.ORDER_NOT_PAYABLE,
      `Pay channel not enabled: ${channel}`,
      400,
      { enabledChannels: enabled }
    );
  }

  if (channel !== 'mock' && !isRealPaymentEnabled()) {
    throw new BillingError(
      ErrorCode.ORDER_NOT_PAYABLE,
      'Real payment is disabled',
      403
    );
  }

  return channel;
}

export async function createPaymentForOrder(
  order: BillingOrderRecord,
  options?: Omit<CreatePaymentInput, 'order'>
): Promise<CreatePaymentResult> {
  const provider = providers[order.payChannel];
  if (!provider) {
    throw new BillingError(
      ErrorCode.ORDER_NOT_PAYABLE,
      `Unsupported pay channel: ${order.payChannel}`,
      400
    );
  }

  return provider.createPayment({
    order,
    scene: options?.scene,
    notifyUrl: options?.notifyUrl,
    returnUrl: options?.returnUrl,
  });
}

export async function verifyWebhookByChannel(
  payChannel: BillingPayChannel,
  request: Request
): Promise<PaymentWebhookEvent> {
  const provider = providers[payChannel];
  if (!provider) {
    throw new BillingError(
      ErrorCode.WEBHOOK_SIGNATURE_INVALID,
      `Unsupported pay channel: ${payChannel}`,
      400
    );
  }

  return provider.verifyWebhook(request);
}
