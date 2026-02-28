import { NextRequest, NextResponse } from 'next/server';
import { getBillingConfig } from '@/lib/billing/config';
import {
  applyIdentityCookie,
  resolveRequestIdentity,
} from '@/lib/billing/identity';
import { getBillingSnapshot } from '@/lib/billing/quota';

export async function GET(request: NextRequest) {
  const identity = await resolveRequestIdentity(request);
  const config = getBillingConfig();
  const snapshot = await getBillingSnapshot(identity.userId, identity.anonId);

  const response = NextResponse.json({
    success: true,
    data: {
      ...snapshot,
      billingEnabled: config.enabled,
    },
  });
  applyIdentityCookie(response, identity);
  return response;
}
