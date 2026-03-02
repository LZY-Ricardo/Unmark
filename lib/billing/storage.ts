import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  billingEntitlements,
  billingOrders,
  billingUsageDaily,
  billingUsers,
  billingWebhookEvents,
} from '@/lib/db/schema';
import type {
  BillingEntitlementRecord,
  BillingOrderRecord,
  BillingPayChannel,
  PaidPlanType,
} from '@/types/billing';

interface BillingUserRecord {
  id: number;
  anonId: string;
  timezone: string;
  createdAt: string;
}

interface UsageDailyRecord {
  userId: number;
  usageDate: string;
  successCount: number;
  softLimitedCount: number;
  updatedAt: string;
}

const usersByAnonId = new Map<string, BillingUserRecord>();
const usageDailyByUserAndDate = new Map<string, UsageDailyRecord>();
const entitlementsByUserId = new Map<number, BillingEntitlementRecord[]>();
const ordersByOrderNo = new Map<string, BillingOrderRecord>();
const ordersByClientRequestId = new Map<string, BillingOrderRecord>();
const processedWebhookKeys = new Set<string>();

let nextUserId = 1;
let nextOrderCounter = 1;
let nextEntitlementCounter = 1;

function nowIso(): string {
  return new Date().toISOString();
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) {
    return nowIso();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? nowIso() : parsed.toISOString();
}

function usageKey(userId: number, usageDate: string): string {
  return `${userId}:${usageDate}`;
}

function generateOrderNo(): string {
  const timestamp = new Date();
  const datePart = `${timestamp.getFullYear()}${`${timestamp.getMonth() + 1}`.padStart(2, '0')}${`${timestamp.getDate()}`.padStart(2, '0')}`;
  const counterPart = `${nextOrderCounter}`.padStart(6, '0');
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  nextOrderCounter += 1;
  return `UM${datePart}${counterPart}${randomPart}`;
}

function toBillingOrderRecord(row: typeof billingOrders.$inferSelect): BillingOrderRecord {
  return {
    orderNo: row.orderNo,
    userId: row.userId,
    planType: row.planType as PaidPlanType,
    amountCents: row.amountCents,
    currency: row.currency as 'CNY',
    status: row.status,
    variant: row.variant as BillingOrderRecord['variant'],
    experimentId: row.experimentId,
    payChannel: row.payChannel as BillingPayChannel,
    clientRequestId: row.clientRequestId,
    transactionId: row.transactionId ?? undefined,
    createdAt: toIso(row.createdAt),
    paidAt: row.paidAt ? toIso(row.paidAt) : undefined,
    fulfilledAt: row.fulfilledAt ? toIso(row.fulfilledAt) : undefined,
  };
}

function toBillingEntitlementRecord(
  row: typeof billingEntitlements.$inferSelect
): BillingEntitlementRecord {
  return {
    id: `ent_${row.id}`,
    userId: row.userId,
    planType: row.planType as PaidPlanType,
    startsAt: toIso(row.startsAt),
    endsAt: toIso(row.endsAt),
    status: row.status,
    sourceOrderNo: row.sourceOrderNo ?? undefined,
  };
}

export async function getOrCreateUser(anonId: string): Promise<BillingUserRecord> {
  const db = getDb();
  if (!db) {
    const existing = usersByAnonId.get(anonId);
    if (existing) {
      return existing;
    }

    const created: BillingUserRecord = {
      id: nextUserId,
      anonId,
      timezone: 'Asia/Shanghai',
      createdAt: nowIso(),
    };
    nextUserId += 1;

    usersByAnonId.set(anonId, created);
    return created;
  }

  const existingRows = await db
    .select()
    .from(billingUsers)
    .where(eq(billingUsers.anonId, anonId))
    .limit(1);

  if (existingRows[0]) {
    return {
      id: existingRows[0].id,
      anonId: existingRows[0].anonId,
      timezone: existingRows[0].timezone,
      createdAt: toIso(existingRows[0].createdAt),
    };
  }

  await db
    .insert(billingUsers)
    .values({
      anonId,
      timezone: 'Asia/Shanghai',
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: billingUsers.anonId });

  const rows = await db
    .select()
    .from(billingUsers)
    .where(eq(billingUsers.anonId, anonId))
    .limit(1);

  if (!rows[0]) {
    throw new Error('Failed to create billing user');
  }

  return {
    id: rows[0].id,
    anonId: rows[0].anonId,
    timezone: rows[0].timezone,
    createdAt: toIso(rows[0].createdAt),
  };
}

export async function getUsageDaily(
  userId: number,
  usageDate: string
): Promise<UsageDailyRecord> {
  const db = getDb();
  if (!db) {
    const key = usageKey(userId, usageDate);
    const existing = usageDailyByUserAndDate.get(key);
    if (existing) {
      return existing;
    }

    const created: UsageDailyRecord = {
      userId,
      usageDate,
      successCount: 0,
      softLimitedCount: 0,
      updatedAt: nowIso(),
    };
    usageDailyByUserAndDate.set(key, created);
    return created;
  }

  const existingRows = await db
    .select()
    .from(billingUsageDaily)
    .where(
      and(
        eq(billingUsageDaily.userId, userId),
        eq(billingUsageDaily.usageDate, usageDate)
      )
    )
    .limit(1);

  if (existingRows[0]) {
    return {
      userId: existingRows[0].userId,
      usageDate: existingRows[0].usageDate,
      successCount: existingRows[0].successCount,
      softLimitedCount: existingRows[0].softLimitedCount,
      updatedAt: toIso(existingRows[0].updatedAt),
    };
  }

  await db
    .insert(billingUsageDaily)
    .values({
      userId,
      usageDate,
      successCount: 0,
      softLimitedCount: 0,
      updatedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [billingUsageDaily.userId, billingUsageDaily.usageDate],
    });

  const rows = await db
    .select()
    .from(billingUsageDaily)
    .where(
      and(
        eq(billingUsageDaily.userId, userId),
        eq(billingUsageDaily.usageDate, usageDate)
      )
    )
    .limit(1);

  if (!rows[0]) {
    throw new Error('Failed to create usage_daily record');
  }

  return {
    userId: rows[0].userId,
    usageDate: rows[0].usageDate,
    successCount: rows[0].successCount,
    softLimitedCount: rows[0].softLimitedCount,
    updatedAt: toIso(rows[0].updatedAt),
  };
}

export async function incrementSuccessUsage(
  userId: number,
  usageDate: string
): Promise<UsageDailyRecord> {
  const db = getDb();
  if (!db) {
    const current = await getUsageDaily(userId, usageDate);
    current.successCount += 1;
    current.updatedAt = nowIso();
    usageDailyByUserAndDate.set(usageKey(userId, usageDate), current);
    return current;
  }

  await db
    .insert(billingUsageDaily)
    .values({
      userId,
      usageDate,
      successCount: 1,
      softLimitedCount: 0,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [billingUsageDaily.userId, billingUsageDaily.usageDate],
      set: {
        successCount: sql`${billingUsageDaily.successCount} + 1`,
        updatedAt: new Date(),
      },
    });

  return getUsageDaily(userId, usageDate);
}

export async function incrementSoftLimitedUsage(
  userId: number,
  usageDate: string
): Promise<UsageDailyRecord> {
  const db = getDb();
  if (!db) {
    const current = await getUsageDaily(userId, usageDate);
    current.softLimitedCount += 1;
    current.updatedAt = nowIso();
    usageDailyByUserAndDate.set(usageKey(userId, usageDate), current);
    return current;
  }

  await db
    .insert(billingUsageDaily)
    .values({
      userId,
      usageDate,
      successCount: 0,
      softLimitedCount: 1,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [billingUsageDaily.userId, billingUsageDaily.usageDate],
      set: {
        softLimitedCount: sql`${billingUsageDaily.softLimitedCount} + 1`,
        updatedAt: new Date(),
      },
    });

  return getUsageDaily(userId, usageDate);
}

export async function listEntitlements(
  userId: number
): Promise<BillingEntitlementRecord[]> {
  const db = getDb();
  if (!db) {
    return entitlementsByUserId.get(userId) ?? [];
  }

  const rows = await db
    .select()
    .from(billingEntitlements)
    .where(eq(billingEntitlements.userId, userId))
    .orderBy(desc(billingEntitlements.endsAt));

  return rows.map(toBillingEntitlementRecord);
}

export async function saveEntitlement(params: {
  userId: number;
  planType: PaidPlanType;
  startsAt: string;
  endsAt: string;
  status?: BillingEntitlementRecord['status'];
  sourceOrderNo?: string;
}): Promise<BillingEntitlementRecord> {
  const db = getDb();
  if (!db) {
    const current = await listEntitlements(params.userId);
    const entitlement: BillingEntitlementRecord = {
      id: `ent_${nextEntitlementCounter}`,
      userId: params.userId,
      planType: params.planType,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      status: params.status ?? 'active',
      sourceOrderNo: params.sourceOrderNo,
    };
    nextEntitlementCounter += 1;
    entitlementsByUserId.set(params.userId, [...current, entitlement]);
    return entitlement;
  }

  const [inserted] = await db
    .insert(billingEntitlements)
    .values({
      userId: params.userId,
      sourceOrderNo: params.sourceOrderNo,
      planType: params.planType,
      status: params.status ?? 'active',
      startsAt: new Date(params.startsAt),
      endsAt: new Date(params.endsAt),
      updatedAt: new Date(),
    })
    .returning();

  if (!inserted) {
    throw new Error('Failed to save entitlement');
  }

  return toBillingEntitlementRecord(inserted);
}

export async function getOrderByNo(
  orderNo: string
): Promise<BillingOrderRecord | null> {
  const db = getDb();
  if (!db) {
    return ordersByOrderNo.get(orderNo) ?? null;
  }

  const rows = await db
    .select()
    .from(billingOrders)
    .where(eq(billingOrders.orderNo, orderNo))
    .limit(1);

  return rows[0] ? toBillingOrderRecord(rows[0]) : null;
}

export async function getOrderByClientRequestId(
  clientRequestId: string
): Promise<BillingOrderRecord | null> {
  const db = getDb();
  if (!db) {
    return ordersByClientRequestId.get(clientRequestId) ?? null;
  }

  const rows = await db
    .select()
    .from(billingOrders)
    .where(eq(billingOrders.clientRequestId, clientRequestId))
    .limit(1);

  return rows[0] ? toBillingOrderRecord(rows[0]) : null;
}

export async function saveOrder(order: BillingOrderRecord): Promise<BillingOrderRecord> {
  const db = getDb();
  if (!db) {
    ordersByOrderNo.set(order.orderNo, order);
    ordersByClientRequestId.set(order.clientRequestId, order);
    return order;
  }

  await db
    .insert(billingOrders)
    .values({
      orderNo: order.orderNo,
      userId: order.userId,
      planType: order.planType,
      amountCents: order.amountCents,
      currency: order.currency,
      variant: order.variant,
      experimentId: order.experimentId,
      payChannel: order.payChannel,
      status: order.status,
      transactionId: order.transactionId,
      clientRequestId: order.clientRequestId,
      paidAt: order.paidAt ? new Date(order.paidAt) : null,
      fulfilledAt: order.fulfilledAt ? new Date(order.fulfilledAt) : null,
      createdAt: new Date(order.createdAt),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: billingOrders.orderNo,
      set: {
        status: order.status,
        transactionId: order.transactionId,
        paidAt: order.paidAt ? new Date(order.paidAt) : null,
        fulfilledAt: order.fulfilledAt ? new Date(order.fulfilledAt) : null,
        amountCents: order.amountCents,
        variant: order.variant,
        experimentId: order.experimentId,
        payChannel: order.payChannel,
        clientRequestId: order.clientRequestId,
        updatedAt: new Date(),
      },
    });

  const saved = await getOrderByNo(order.orderNo);
  if (!saved) {
    throw new Error('Failed to save order');
  }

  return saved;
}

export async function createOrderRecord(input: {
  userId: number;
  planType: PaidPlanType;
  amountCents: number;
  variant: BillingOrderRecord['variant'];
  experimentId: string;
  payChannel: BillingPayChannel;
  clientRequestId: string;
}): Promise<BillingOrderRecord> {
  const order: BillingOrderRecord = {
    orderNo: generateOrderNo(),
    userId: input.userId,
    planType: input.planType,
    amountCents: input.amountCents,
    currency: 'CNY',
    status: 'created',
    variant: input.variant,
    experimentId: input.experimentId,
    payChannel: input.payChannel,
    clientRequestId: input.clientRequestId,
    createdAt: nowIso(),
  };

  return saveOrder(order);
}

export async function markWebhookProcessedOnce(key: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    if (processedWebhookKeys.has(key)) {
      return false;
    }
    processedWebhookKeys.add(key);
    return true;
  }

  const [inserted] = await db
    .insert(billingWebhookEvents)
    .values({
      eventKey: key,
      transactionId: key.split(':')[0] || key,
      eventType: key.split(':')[1] || 'unknown',
    })
    .onConflictDoNothing({ target: billingWebhookEvents.eventKey })
    .returning({ id: billingWebhookEvents.id });

  return Boolean(inserted?.id);
}
