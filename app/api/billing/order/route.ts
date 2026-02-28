import { NextRequest, NextResponse } from 'next/server';
import { getBillingConfig } from '@/lib/billing/config';
import { asBillingError, BillingError } from '@/lib/billing/errors';
import {
  applyIdentityCookie,
  resolveRequestIdentity,
} from '@/lib/billing/identity';
import { createOrder } from '@/lib/billing/order';
import { getBillingSnapshot } from '@/lib/billing/quota';
import { ErrorCode } from '@/types';
import type { PaidPlanType } from '@/types/billing';

interface CreateOrderBody {
  planType?: PaidPlanType;
  clientRequestId?: string;
}

function isPaidPlanType(value: string): value is PaidPlanType {
  return value === 'day' || value === 'month';
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

    const order = await createOrder({
      userId: identity.userId,
      anonId: identity.anonId,
      planType,
      clientRequestId,
    });

    const snapshot = await getBillingSnapshot(identity.userId, identity.anonId);
    const response = NextResponse.json({
      success: true,
      data: {
        orderNo: order.orderNo,
        amountCents: order.amountCents,
        orderStatus: order.status,
        payChannel: order.payChannel,
        activePlan: snapshot.activePlan,
        paymentPayload: {
          mockToken: `pay_${order.orderNo}`,
        },
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
