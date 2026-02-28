import { consumeUsage } from '@/lib/billing/quota';
import { getOrCreateUser } from '@/lib/billing/storage';

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
      cookies: {
        set: jest.fn(),
      },
    }),
  },
}));

let POST: (request: any) => Promise<any>;

function createRequest(body: unknown, anonId = 'test-anon') {
  return {
    json: async () => body,
    headers: {
      get: (key: string) => (key === 'x-anon-id' ? anonId : null),
    },
    cookies: {
      get: () => undefined,
    },
  } as any;
}

describe('/api/parse', () => {
  beforeAll(async () => {
    const route = await import('@/app/api/parse/route');
    POST = route.POST;
  });

  beforeEach(() => {
    process.env.BILLING_ENABLED = 'false';
    process.env.BILLING_FREE_DAILY_LIMIT = '1';
    process.env.BILLING_EXPERIMENT_ENABLED = 'false';
  });

  it('returns INVALID_URL for missing URL', async () => {
    const response = await POST(createRequest({ url: '' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INVALID_URL');
  });

  it('returns INVALID_URL for unsupported platform', async () => {
    const response = await POST(createRequest({ url: 'https://google.com' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INVALID_URL');
  });

  it('returns PAYWALL_REQUIRED when free quota is exhausted', async () => {
    process.env.BILLING_ENABLED = 'true';

    const anonId = 'billing-user-1';
    const user = await getOrCreateUser(anonId);
    await consumeUsage(user.id);

    const response = await POST(
      createRequest({ url: 'https://v.douyin.com/abc123/' }, anonId)
    );
    const data = await response.json();

    expect(response.status).toBe(402);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('PAYWALL_REQUIRED');
    expect(Array.isArray(data.error.details.plans)).toBe(true);
  });
});
