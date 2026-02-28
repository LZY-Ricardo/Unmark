const CLIENT_ANON_KEY = 'um_anon_id';

function createAnonId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getClientAnonId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const fromStorage = window.localStorage.getItem(CLIENT_ANON_KEY);
  if (fromStorage) {
    return fromStorage;
  }

  const anonId = createAnonId();
  window.localStorage.setItem(CLIENT_ANON_KEY, anonId);
  document.cookie = `${CLIENT_ANON_KEY}=${anonId}; path=/; max-age=31536000; samesite=lax`;
  return anonId;
}

export function withClientAnonHeader(
  headers: HeadersInit = {}
): HeadersInit {
  const anonId = getClientAnonId();
  if (!anonId) {
    return headers;
  }

  return {
    ...headers,
    'x-anon-id': anonId,
  };
}
