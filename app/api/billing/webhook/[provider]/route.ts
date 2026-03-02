import { NextRequest, NextResponse } from 'next/server';
import { getBillingConfig } from '@/lib/billing/config';
import { asBillingError, BillingError } from '@/lib/billing/errors';
import {
  isBillingPayChannel,
  verifyWebhookByChannel,
} from '@/lib/billing/payments/gateway';
import { processPaymentWebhook } from '@/lib/billing/order';
import { ErrorCode } from '@/types';

interface RouteParams {
  params: Promise<{ provider: string }>;
}

export async function POST(request: NextRequest, context: RouteParams) {
  const providerParam = (await context.params).provider || '';
  const normalized = providerParam.trim().toLowerCase();

  try {
    const config = getBillingConfig();
    if (!config.webhookEnabled) {
      throw new BillingError(
        ErrorCode.WEBHOOK_SIGNATURE_INVALID,
        'Webhook is disabled',
        403
      );
    }

    if (!isBillingPayChannel(normalized) || normalized === 'mock') {
      throw new BillingError(
        ErrorCode.WEBHOOK_SIGNATURE_INVALID,
        `Unsupported webhook provider: ${providerParam}`,
        400
      );
    }

    const event = await verifyWebhookByChannel(normalized, request);
    const order = await processPaymentWebhook({
      payChannel: normalized,
      orderNo: event.orderNo,
      transactionId: event.transactionId,
      eventType: event.eventType,
      paidAmountCents: event.paidAmountCents,
    });

    if (normalized === 'alipay') {
      return new NextResponse('success', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        provider: normalized,
        orderNo: order.orderNo,
        orderStatus: order.status,
      },
    });
  } catch (error: unknown) {
    const billingError = asBillingError(error);
    if (normalized === 'alipay') {
      return new NextResponse('failure', {
        status: Math.max(400, billingError.status),
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }
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
