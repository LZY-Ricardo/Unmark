import { NextRequest, NextResponse } from 'next/server';
import { getBillingConfig } from '@/lib/billing/config';
import { asBillingError, BillingError } from '@/lib/billing/errors';
import {
  applyIdentityCookie,
  resolveRequestIdentity,
} from '@/lib/billing/identity';
import { createOrder } from '@/lib/billing/order';
import { isBillingPayChannel } from '@/lib/billing/payments/gateway';
import { getBillingSnapshot } from '@/lib/billing/quota';
import { ErrorCode } from '@/types';
import type { BillingPayChannel, BillingPayScene, PaidPlanType } from '@/types/billing';

interface CreateOrderBody {
  planType?: PaidPlanType;
  payChannel?: BillingPayChannel;
  payScene?: BillingPayScene;
  returnUrl?: string;
  clientRequestId?: string;
}

function isPaidPlanType(value: string): value is PaidPlanType {
  return value === 'day' || value === 'month';
}

function isBillingPayScene(value: string): value is BillingPayScene {
  return value === 'h5' || value === 'web' || value === 'qr';
}

export async function POST(request: NextRequest) {
  const identity = await resolveRequestIdentity(request);

  try {
    const config = getBillingConfig();
    if (!config.enabled) {
      throw new BillingError(
        ErrorCode.ORDER_NOT_PAYABLE,
        'Billing is disabled',
        403
      );
    }

    const body = (await request.json()) as CreateOrderBody;
    const planType = typeof body.planType === 'string' ? body.planType : '';
    const payChannelRaw = typeof body.payChannel === 'string' ? body.payChannel : '';
    const paySceneRaw = typeof body.payScene === 'string' ? body.payScene : '';
    const returnUrl = typeof body.returnUrl === 'string' ? body.returnUrl.trim() : '';
    const clientRequestId =
      typeof body.clientRequestId === 'string' ? body.clientRequestId.trim() : '';

    if (!isPaidPlanType(planType)) {
      throw new BillingError(
        ErrorCode.ORDER_NOT_PAYABLE,
        'Invalid plan type',
        400
      );
    }

    if (!clientRequestId) {
      throw new BillingError(
        ErrorCode.ORDER_NOT_PAYABLE,
        'clientRequestId is required',
        400
      );
    }
    if (payChannelRaw && !isBillingPayChannel(payChannelRaw)) {
      throw new BillingError(
        ErrorCode.ORDER_NOT_PAYABLE,
        'Invalid pay channel',
        400
      );
    }
    if (paySceneRaw && !isBillingPayScene(paySceneRaw)) {
      throw new BillingError(
        ErrorCode.ORDER_NOT_PAYABLE,
        'Invalid pay scene',
        400
      );
    }

    const result = await createOrder({
      userId: identity.userId,
      anonId: identity.anonId,
      planType,
      payChannel: payChannelRaw || undefined,
      payScene: paySceneRaw || undefined,
      returnUrl: returnUrl || undefined,
      clientRequestId,
    });

    const snapshot = await getBillingSnapshot(identity.userId, identity.anonId);
    const response = NextResponse.json({
      success: true,
      data: {
        orderNo: result.order.orderNo,
        amountCents: result.order.amountCents,
        orderStatus: result.order.status,
        payChannel: result.order.payChannel,
        activePlan: snapshot.activePlan,
        providerOrderNo: result.payment.providerOrderNo,
        paymentExpiresAt: result.payment.expiresAt,
        paymentPayload: result.payment.paymentPayload,
      },
    });
    applyIdentityCookie(response, identity);
    return response;
  } catch (error: unknown) {
    const billingError = asBillingError(error);
    const response = NextResponse.json(
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
    applyIdentityCookie(response, identity);
    return response;
  }
}
