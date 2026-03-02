import { BillingError } from '@/lib/billing/errors';
import { ErrorCode } from '@/types';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentWebhookEvent,
} from '@/lib/billing/payments/types';

function requireWechatConfig(): void {
  const requiredKeys = [
    'WECHAT_MCH_ID',
    'WECHAT_APP_ID',
    'WECHAT_API_V3_KEY',
    'WECHAT_PRIVATE_KEY',
    'WECHAT_SERIAL_NO',
  ] as const;
  const missing = requiredKeys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new BillingError(
      ErrorCode.ORDER_NOT_PAYABLE,
      `WeChat Pay is not configured: missing ${missing.join(', ')}`,
      503
    );
  }
}

export class WechatPaymentProvider implements PaymentProvider {
  readonly payChannel = 'wechat' as const;

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    requireWechatConfig();

    const expireMinutes = Number.parseInt(process.env.WECHAT_ORDER_EXPIRE_MIN || '', 10);
    const ttlMinutes = Number.isNaN(expireMinutes) ? 15 : Math.min(Math.max(expireMinutes, 5), 60);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    return {
      payChannel: this.payChannel,
      providerOrderNo: input.order.orderNo,
      status: 'requires_action',
      expiresAt,
      paymentPayload: {
        gateway: 'wechat',
        scene: input.scene || 'h5',
        outTradeNo: input.order.orderNo,
        amountCents: input.order.amountCents,
        message: 'WeChat provider skeleton: replace with SDK order creation response.',
      },
    };
  }

  async verifyWebhook(request: Request): Promise<PaymentWebhookEvent> {
    const signature = request.headers.get('x-wechat-signature') || '';
    const expected = process.env.WECHAT_WEBHOOK_SECRET || '';
    if (expected && signature !== expected) {
      throw new BillingError(
        ErrorCode.WEBHOOK_SIGNATURE_INVALID,
        'WeChat webhook signature invalid',
        401
      );
    }

    const payload = (await request.json()) as {
      orderNo?: string;
      transactionId?: string;
      eventType?: string;
    };
    const orderNo = typeof payload.orderNo === 'string' ? payload.orderNo.trim() : '';
    const transactionId =
      typeof payload.transactionId === 'string' ? payload.transactionId.trim() : '';
    const eventType = payload.eventType || 'transaction.success';

    if (!orderNo || !transactionId) {
      throw new BillingError(
        ErrorCode.WEBHOOK_SIGNATURE_INVALID,
        'orderNo and transactionId are required',
        400
      );
    }

    return {
      payChannel: this.payChannel,
      orderNo,
      transactionId,
      eventType,
      rawPayload: payload,
    };
  }
}
