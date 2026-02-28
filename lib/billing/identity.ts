import { NextRequest, NextResponse } from 'next/server';
import {
  BILLING_ANON_COOKIE,
  BILLING_ANON_HEADER,
} from '@/lib/billing/config';
import { getOrCreateUser } from '@/lib/billing/storage';

export interface RequestIdentity {
  anonId: string;
  userId: number;
  shouldSetCookie: boolean;
}

function generateAnonId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function sanitizeAnonId(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

export async function resolveRequestIdentity(
  request: NextRequest
): Promise<RequestIdentity> {
  const headerAnonId = request.headers.get(BILLING_ANON_HEADER) ?? '';
  const cookieAnonId = request.cookies.get(BILLING_ANON_COOKIE)?.value ?? '';
  const fromRequest = sanitizeAnonId(headerAnonId || cookieAnonId);
  const anonId = fromRequest || generateAnonId();
  const user = await getOrCreateUser(anonId);

  return {
    anonId,
    userId: user.id,
    shouldSetCookie: !cookieAnonId || cookieAnonId !== anonId,
  };
}

export function applyIdentityCookie(response: NextResponse, identity: RequestIdentity): void {
  if (!identity.shouldSetCookie) {
    return;
  }

  response.cookies.set(BILLING_ANON_COOKIE, identity.anonId, {
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}
