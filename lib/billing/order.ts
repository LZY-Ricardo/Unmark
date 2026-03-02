import { getBillingConfig } from '@/lib/billing/config';
import { BillingError } from '@/lib/billing/errors';
import {
  createPaymentForOrder,
  resolveOrderPayChannel,
} from '@/lib/billing/payments/gateway';
import { getPlanPriceCents } from '@/lib/billing/pricing';
import {
  createOrderRecord,
  getOrderByClientRequestId,
  getOrderByNo,
  listEntitlements,
  markWebhookProcessedOnce,
  saveEntitlement,
  saveOrder,
} from '@/lib/billing/storage';
import { getBillingSnapshot } from '@/lib/billing/quota';
import { ErrorCode } from '@/types';
import type {
  BillingOrderRecord,
  BillingPayChannel,
  BillingPayScene,
  PaidPlanType,
} from '@/types/billing';
import type { CreatePaymentResult } from '@/lib/billing/payments/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;

function asIso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

async function latestPlanEnd(userId: number, planType: PaidPlanType): Promise<number> {
  const records = await listEntitlements(userId);
  let latest = 0;

  for (const record of records) {
    if (record.planType !== planType || record.status !== 'active') {
      continue;
    }
    const end = Date.parse(record.endsAt);
    if (end > latest) {
      latest = end;
    }
  }

  return latest;
}

async function grantEntitlement(order: BillingOrderRecord): Promise<void> {
  const now = Date.now();
  const baseEnd = await latestPlanEnd(order.userId, order.planType);
  const startsAt = Math.max(now, baseEnd);
  const duration = order.planType === 'day' ? DAY_MS : MONTH_MS;
  const endsAt = startsAt + duration;

  await saveEntitlement({
    userId: order.userId,
    planType: order.planType,
    startsAt: asIso(startsAt),
    endsAt: asIso(endsAt),
    sourceOrderNo: order.orderNo,
  });
}

async function fulfillOrderInternal(
  order: BillingOrderRecord,
  transactionId: string
): Promise<BillingOrderRecord> {
  if (order.status === 'fulfilled') {
    return order;
  }

  if (order.status === 'failed' || order.status === 'refunded') {
    throw new BillingError(
      ErrorCode.ORDER_NOT_PAYABLE,
      'Order is not payable in current status',
      409
    );
  }

  const paidOrder: BillingOrderRecord = {
    ...order,
    status: 'paid',
    transactionId,
    paidAt: new Date().toISOString(),
  };
  await saveOrder(paidOrder);

  await grantEntitlement(paidOrder);

  const fulfilledOrder: BillingOrderRecord = {
    ...paidOrder,
    status: 'fulfilled',
    fulfilledAt: new Date().toISOString(),
  };
  await saveOrder(fulfilledOrder);
  return fulfilledOrder;
}

function asCreatePaymentResultFromExisting(order: BillingOrderRecord): CreatePaymentResult {
  const status = order.status === 'fulfilled' ? 'succeeded' : 'requires_action';
  return {
    payChannel: order.payChannel,
    providerOrderNo: order.orderNo,
    status,
    transactionId: order.transactionId,
    paymentPayload: {
      reusedOrder: true,
    },
  };
}

export interface CreateOrderResult {
  order: BillingOrderRecord;
  payment: CreatePaymentResult;
}

export async function createOrder(params: {
  userId: number;
  anonId: string;
  planType: PaidPlanType;
  payChannel?: BillingPayChannel;
  payScene?: BillingPayScene;
  returnUrl?: string;
  clientRequestId: string;
}): Promise<CreateOrderResult> {
  const existing = await getOrderByClientRequestId(params.clientRequestId);
  if (existing) {
    return {
      order: existing,
      payment: asCreatePaymentResultFromExisting(existing),
    };
  }

  const snapshot = await getBillingSnapshot(params.userId, params.anonId);
  if (params.planType === 'day' && snapshot.activePlan === 'month') {
    throw new BillingError(
      ErrorCode.ORDER_NOT_PAYABLE,
      'Month pass is active, day pass purchase is blocked',
      409
    );
  }

  const amountCents = getPlanPriceCents(snapshot.variant, params.planType);
  const config = getBillingConfig();
  const payChannel = resolveOrderPayChannel(params.payChannel);
  const order = await createOrderRecord({
    userId: params.userId,
    planType: params.planType,
    amountCents,
    variant: snapshot.variant,
    experimentId: config.experimentId,
    payChannel,
    clientRequestId: params.clientRequestId,
  });

  const payment = await createPaymentForOrder(order, {
    scene: params.payScene,
    returnUrl: params.returnUrl,
  });
  if (payment.status === 'succeeded') {
    const transactionId = payment.transactionId || `pay_${order.orderNo}`;
    const fulfilled = await fulfillOrderInternal(order, transactionId);
    return {
      order: fulfilled,
      payment,
    };
  }

  const pendingOrder: BillingOrderRecord = { ...order, status: 'paying' };
  await saveOrder(pendingOrder);
  return {
    order: pendingOrder,
    payment,
  };
}

export async function refreshOrder(orderNo: string): Promise<BillingOrderRecord> {
  const order = await getOrderByNo(orderNo);
  if (!order) {
    throw new BillingError(ErrorCode.ORDER_NOT_FOUND, 'Order not found', 404);
  }
  return order;
}

export async function processPaymentWebhook(params: {
  payChannel: BillingPayChannel;
  orderNo: string;
  transactionId: string;
  eventType: string;
  paidAmountCents?: number;
}): Promise<BillingOrderRecord> {
  const key = `${params.payChannel}:${params.transactionId}:${params.eventType}`;
  if (!(await markWebhookProcessedOnce(key))) {
    const existing = await getOrderByNo(params.orderNo);
    if (!existing) {
      throw new BillingError(ErrorCode.ORDER_NOT_FOUND, 'Order not found', 404);
    }
    return existing;
  }

  const order = await getOrderByNo(params.orderNo);
  if (!order) {
    throw new BillingError(ErrorCode.ORDER_NOT_FOUND, 'Order not found', 404);
  }
  if (order.payChannel !== params.payChannel) {
    throw new BillingError(
      ErrorCode.WEBHOOK_SIGNATURE_INVALID,
      'Webhook pay channel mismatch',
      409
    );
  }
  if (
    typeof params.paidAmountCents === 'number' &&
    params.paidAmountCents !== order.amountCents
  ) {
    throw new BillingError(
      ErrorCode.WEBHOOK_SIGNATURE_INVALID,
      'Webhook amount mismatch',
      409
    );
  }

  const eventType = params.eventType.toLowerCase();
  const isPaidEvent =
    eventType.includes('success') ||
    eventType.includes('finished') ||
    eventType.includes('paid');

  if (!isPaidEvent) {
    return order;
  }

  return fulfillOrderInternal(order, params.transactionId);
}
