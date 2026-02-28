import { getBillingConfig } from '@/lib/billing/config';
import { resolveVariant } from '@/lib/billing/pricing';
import {
  getUsageDaily,
  incrementSoftLimitedUsage,
  incrementSuccessUsage,
  listEntitlements,
} from '@/lib/billing/storage';
import type {
  BillingEntitlementRecord,
  BillingPlanType,
  BillingSnapshot,
  BillingVariant,
} from '@/types/billing';

interface ActiveEntitlementResult {
  activePlan: BillingPlanType;
  currentEntitlement: BillingEntitlementRecord | null;
}

export interface QuotaDecision {
  allowed: boolean;
  requiresPaywall: boolean;
  fairUseLimited: boolean;
  snapshot: BillingSnapshot;
}

function getTodayDateInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

async function resolveActiveEntitlement(
  userId: number,
  now = Date.now()
): Promise<ActiveEntitlementResult> {
  const records = await listEntitlements(userId);
  let current: BillingEntitlementRecord | null = null;

  for (const record of records) {
    const start = Date.parse(record.startsAt);
    const end = Date.parse(record.endsAt);
    const isActive = record.status === 'active' && start <= now && end > now;
    if (!isActive) {
      continue;
    }

    if (!current) {
      current = record;
      continue;
    }

    if (record.planType === 'month' && current.planType !== 'month') {
      current = record;
      continue;
    }

    if (Date.parse(record.endsAt) > Date.parse(current.endsAt)) {
      current = record;
    }
  }

  if (!current) {
    return { activePlan: 'free', currentEntitlement: null };
  }

  return {
    activePlan: current.planType,
    currentEntitlement: current,
  };
}

function resolveVariantForUser(anonId: string): BillingVariant {
  const config = getBillingConfig();
  if (!config.experimentEnabled) {
    return 'A';
  }
  return resolveVariant(anonId);
}

export async function getBillingSnapshot(
  userId: number,
  anonId: string
): Promise<BillingSnapshot> {
  const config = getBillingConfig();
  const variant = resolveVariantForUser(anonId);
  const { activePlan, currentEntitlement } = await resolveActiveEntitlement(userId);
  const today = getTodayDateInTimezone(config.timezone);
  const usage = await getUsageDaily(userId, today);
  const freeRemaining = Math.max(config.freeDailyLimit - usage.successCount, 0);

  return {
    variant,
    activePlan,
    freeDailyLimit: config.freeDailyLimit,
    freeRemaining,
    fairUseSoftCap: config.fairUseDailySoftCap,
    prices: {
      day: config.prices[variant].day,
      month: config.prices[variant].month,
    },
    currentEntitlement,
  };
}

export async function evaluateQuota(
  userId: number,
  anonId: string
): Promise<QuotaDecision> {
  const config = getBillingConfig();
  const snapshot = await getBillingSnapshot(userId, anonId);
  const today = getTodayDateInTimezone(config.timezone);
  const usage = await getUsageDaily(userId, today);

  if (!config.enabled) {
    return {
      allowed: true,
      requiresPaywall: false,
      fairUseLimited: false,
      snapshot,
    };
  }

  const hasPaidPlan = snapshot.activePlan === 'day' || snapshot.activePlan === 'month';
  const requiresPaywall = !hasPaidPlan && snapshot.freeRemaining <= 0;
  const fairUseLimited =
    hasPaidPlan &&
    config.fairUseEnabled &&
    usage.successCount >= config.fairUseDailySoftCap;

  return {
    allowed: !requiresPaywall,
    requiresPaywall,
    fairUseLimited,
    snapshot,
  };
}

export async function consumeUsage(userId: number): Promise<void> {
  const { timezone } = getBillingConfig();
  const today = getTodayDateInTimezone(timezone);
  await incrementSuccessUsage(userId, today);
}

export async function recordSoftLimitedUsage(userId: number): Promise<void> {
  const { timezone } = getBillingConfig();
  const today = getTodayDateInTimezone(timezone);
  await incrementSoftLimitedUsage(userId, today);
}
