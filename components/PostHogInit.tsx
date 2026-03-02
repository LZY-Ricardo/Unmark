'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogUiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialized = false;

export function PostHogInit() {
  useEffect(() => {
    if (initialized || !posthogKey) {
      return;
    }

    posthog.init(posthogKey, {
      // Use first-party path to reduce adblock/privacy extension interception.
      api_host: '/ph',
      ui_host: posthogUiHost,
      // We track product events manually; keep auto pageview off to reduce noise.
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
      persistence: 'localStorage+cookie',
    });

    initialized = true;
  }, []);

  return null;
}
