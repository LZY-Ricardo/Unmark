import { NextRequest, NextResponse } from 'next/server';
import { asBillingError, BillingError } from '@/lib/billing/errors';
import {
  applyIdentityCookie,
  resolveRequestIdentity,
} from '@/lib/billing/identity';
import { refreshOrder } from '@/lib/billing/order';
import { getBillingSnapshot } from '@/lib/billing/quota';
import { ErrorCode } from '@/types';

interface RefreshOrderBody {
  orderNo?: string;
}

export async function POST(request: NextRequest) {
  const identity = await resolveRequestIdentity(request);

  try {
    const body = (await request.json()) as RefreshOrderBody;
    const orderNo = typeof body.orderNo === 'string' ? body.orderNo.trim() : '';
    if (!orderNo) {
      throw new BillingError(ErrorCode.ORDER_NOT_FOUND, 'orderNo is required', 400);
    }

    const order = await refreshOrder(orderNo);
    if (order.userId !== identity.userId) {
      throw new BillingError(ErrorCode.ORDER_NOT_FOUND, 'Order not found', 404);
    }

    const snapshot = await getBillingSnapshot(identity.userId, identity.anonId);
    const response = NextResponse.json({
      success: true,
      data: {
        orderNo: order.orderNo,
        orderStatus: order.status,
        activePlan: snapshot.activePlan,
        currentEntitlement: snapshot.currentEntitlement,
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
