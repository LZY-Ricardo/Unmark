export const BILLING_ANON_COOKIE = 'um_anon_id';
export const BILLING_ANON_HEADER = 'x-anon-id';
export const BILLING_EXPERIMENT_ID_FALLBACK = 'pricing_v1';

export interface BillingConfig {
  enabled: boolean;
  experimentEnabled: boolean;
  webhookEnabled: boolean;
  fairUseEnabled: boolean;
  timezone: string;
  freeDailyLimit: number;
  fairUseDailySoftCap: number;
  experimentId: string;
  prices: {
    A: { day: number; month: number };
    B: { day: number; month: number };
  };
}

function readBoolean(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }

  return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes';
}

function readInteger(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function getBillingConfig(): BillingConfig {
  return {
    enabled: readBoolean('BILLING_ENABLED', false),
    experimentEnabled: readBoolean('BILLING_EXPERIMENT_ENABLED', false),
    webhookEnabled: readBoolean('BILLING_WEBHOOK_ENABLED', false),
    fairUseEnabled: readBoolean('BILLING_FAIR_USE_ENABLED', true),
    timezone: process.env.APP_TIMEZONE || 'Asia/Shanghai',
    freeDailyLimit: readInteger('BILLING_FREE_DAILY_LIMIT', 1),
    fairUseDailySoftCap: readInteger('BILLING_FAIR_USE_DAILY_SOFT_CAP', 80),
    experimentId: process.env.BILLING_EXPERIMENT_ID || BILLING_EXPERIMENT_ID_FALLBACK,
    prices: {
      A: {
        day: readInteger('BILLING_DAY_PRICE_A', 290),
        month: readInteger('BILLING_MONTH_PRICE_A', 1990),
      },
      B: {
        day: readInteger('BILLING_DAY_PRICE_B', 390),
        month: readInteger('BILLING_MONTH_PRICE_B', 2490),
      },
    },
  };
}
