import { getBillingConfig } from '@/lib/billing/config';
import { BillingError } from '@/lib/billing/errors';
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
import type { BillingOrderRecord, PaidPlanType } from '@/types/billing';

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

export async function createOrder(params: {
  userId: number;
  anonId: string;
  planType: PaidPlanType;
  clientRequestId: string;
}): Promise<BillingOrderRecord> {
  const existing = await getOrderByClientRequestId(params.clientRequestId);
  if (existing) {
    return existing;
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
  const order = await createOrderRecord({
    userId: params.userId,
    planType: params.planType,
    amountCents,
    variant: snapshot.variant,
    experimentId: config.experimentId,
    clientRequestId: params.clientRequestId,
  });

  if (config.webhookEnabled) {
    const pendingOrder: BillingOrderRecord = { ...order, status: 'paying' };
    await saveOrder(pendingOrder);
    return pendingOrder;
  }

  return fulfillOrderInternal(order, `mock_${order.orderNo}`);
}

export async function refreshOrder(orderNo: string): Promise<BillingOrderRecord> {
  const order = await getOrderByNo(orderNo);
  if (!order) {
    throw new BillingError(ErrorCode.ORDER_NOT_FOUND, 'Order not found', 404);
  }
  return order;
}

export async function processPaymentWebhook(params: {
  orderNo: string;
  transactionId: string;
  eventType: string;
}): Promise<BillingOrderRecord> {
  const key = `${params.transactionId}:${params.eventType}`;
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

  return fulfillOrderInternal(order, params.transactionId);
}
