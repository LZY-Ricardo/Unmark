import { BillingError } from '@/lib/billing/errors';
import { ErrorCode } from '@/types';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentWebhookEvent,
} from '@/lib/billing/payments/types';

export class MockPaymentProvider implements PaymentProvider {
  readonly payChannel = 'mock' as const;

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const transactionId = `mock_${input.order.orderNo}`;
    return {
      payChannel: this.payChannel,
      providerOrderNo: input.order.orderNo,
      status: 'succeeded',
      transactionId,
      paymentPayload: {
        mockToken: `pay_${input.order.orderNo}`,
      },
    };
  }

  async verifyWebhook(request: Request): Promise<PaymentWebhookEvent> {
    const payload = (await request.json()) as {
      orderNo?: string;
      transactionId?: string;
      eventType?: string;
    };
    const orderNo = typeof payload.orderNo === 'string' ? payload.orderNo.trim() : '';
    const transactionId =
      typeof payload.transactionId === 'string' ? payload.transactionId.trim() : '';
    const eventType =
      typeof payload.eventType === 'string' && payload.eventType
        ? payload.eventType
        : 'payment.success';

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
