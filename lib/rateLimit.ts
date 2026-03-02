import { NextRequest } from 'next/server';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  maxRequests: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const STORE_KEY = '__unmark_rate_limit_store_v1__';
const STORE_SOFT_LIMIT = 20_000;
let cleanupCursor = 0;

function getStore(): Map<string, RateLimitEntry> {
  const scoped = globalThis as typeof globalThis & {
    [STORE_KEY]?: Map<string, RateLimitEntry>;
  };

  if (!scoped[STORE_KEY]) {
    scoped[STORE_KEY] = new Map<string, RateLimitEntry>();
  }

  return scoped[STORE_KEY];
}

function cleanupExpired(store: Map<string, RateLimitEntry>, now: number): void {
  cleanupCursor += 1;

  if (cleanupCursor % 200 !== 0 && store.size < 5_000) {
    return;
  }

  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }

  if (store.size <= STORE_SOFT_LIMIT) {
    return;
  }

  const sorted = [...store.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
  const overflow = store.size - STORE_SOFT_LIMIT;

  for (let i = 0; i < overflow; i += 1) {
    const candidate = sorted[i];
    if (candidate) {
      store.delete(candidate[0]);
    }
  }
}

function normalizeUserAgent(userAgent: string | null): string {
  if (!userAgent) {
    return 'unknown';
  }
  return userAgent.replace(/\s+/g, ' ').trim().slice(0, 200) || 'unknown';
}

export function getClientIp(request: NextRequest): string {
  const forwardedFor =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-vercel-forwarded-for') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    '';

  const ip = forwardedFor.split(',')[0]?.trim();
  return ip || 'unknown';
}

export function getRateLimitKey(request: NextRequest, namespace: string): string {
  const ip = getClientIp(request);
  const userAgent = normalizeUserAgent(request.headers.get('user-agent'));
  return `${namespace}:${ip}:${userAgent}`;
}

export function applyRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const store = getStore();

  cleanupExpired(store, now);

  const existing = store.get(options.key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    store.set(options.key, { count: 1, resetAt });
    return {
      allowed: true,
      limit: options.maxRequests,
      remaining: Math.max(options.maxRequests - 1, 0),
      resetAt,
      retryAfterSeconds: Math.max(Math.ceil(options.windowMs / 1000), 1),
    };
  }

  if (existing.count >= options.maxRequests) {
    const retryAfterSeconds = Math.max(Math.ceil((existing.resetAt - now) / 1000), 1);
    return {
      allowed: false,
      limit: options.maxRequests,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds,
    };
  }

  existing.count += 1;
  store.set(options.key, existing);

  return {
    allowed: true,
    limit: options.maxRequests,
    remaining: Math.max(options.maxRequests - existing.count, 0),
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.max(Math.ceil((existing.resetAt - now) / 1000), 1),
  };
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}
