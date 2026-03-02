import { NextRequest, NextResponse } from 'next/server';
import { getBillingConfig } from '@/lib/billing/config';
import { asBillingError, BillingError } from '@/lib/billing/errors';
import { processPaymentWebhook } from '@/lib/billing/order';
import { ErrorCode } from '@/types';

interface BillingWebhookBody {
  orderNo?: string;
  transactionId?: string;
  eventType?: string;
}

export async function POST(request: NextRequest) {
  try {
    const config = getBillingConfig();
    if (!config.webhookEnabled) {
      throw new BillingError(
        ErrorCode.WEBHOOK_SIGNATURE_INVALID,
        'Webhook is disabled',
        403
      );
    }

    const expectedSecret = process.env.PAY_WEBHOOK_SECRET || '';
    if (expectedSecret) {
      const providedSecret = request.headers.get('x-webhook-secret') || '';
      if (providedSecret !== expectedSecret) {
        throw new BillingError(
          ErrorCode.WEBHOOK_SIGNATURE_INVALID,
          'Webhook signature invalid',
          401
        );
      }
    }

    const body = (await request.json()) as BillingWebhookBody;
    const orderNo = typeof body.orderNo === 'string' ? body.orderNo.trim() : '';
    const transactionId =
      typeof body.transactionId === 'string' ? body.transactionId.trim() : '';
    const eventType = typeof body.eventType === 'string' ? body.eventType : 'payment.success';

    if (!orderNo || !transactionId) {
      throw new BillingError(
        ErrorCode.WEBHOOK_SIGNATURE_INVALID,
        'orderNo and transactionId are required',
        400
      );
    }

    const order = await processPaymentWebhook({
      payChannel: 'mock',
      orderNo,
      transactionId,
      eventType,
    });

    return NextResponse.json({
      success: true,
      data: {
        orderNo: order.orderNo,
        orderStatus: order.status,
      },
    });
  } catch (error: unknown) {
    const billingError = asBillingError(error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: billingError.code,
          message: billingError.message,
          details: billingError.details,
        },
      },
      { status: billingError.status }
    );
  }
}
