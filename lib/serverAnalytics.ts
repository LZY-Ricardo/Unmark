type AnalyticsPrimitive = string | number | boolean | null | undefined;
type AnalyticsProperties = Record<string, AnalyticsPrimitive>;

const posthogKey = process.env.POSTHOG_PROJECT_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const posthogHost = (process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com')
  .replace(/\/+$/, '');

interface ServerTrackPayload {
  event: string;
  distinctId: string;
  properties: AnalyticsProperties;
}

export async function trackServerEvent({
  event,
  distinctId,
  properties,
}: ServerTrackPayload): Promise<void> {
  if (!posthogKey) {
    return;
  }

  try {
    await fetch(`${posthogHost}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: posthogKey,
        event,
        properties: {
          distinct_id: distinctId,
          source: 'api.parse',
          ...properties,
        },
      }),
    });
  } catch {
    // Ignore analytics failures, never break business flow.
  }
}
