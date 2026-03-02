import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import type { ParseResult } from '@/types';
import { parseXiaohongshuNoCookie } from '@/lib/xiaohongshu/parser';
import { parseKuaishouNoCookie } from '@/lib/kuaishou/parser';
import { trackServerEvent } from '@/lib/serverAnalytics';
import { applyRateLimit, getRateLimitHeaders, getRateLimitKey } from '@/lib/rateLimit';

type AnyObject = Record<string, unknown>;
type Platform = 'douyin' | 'tiktok' | 'kuaishou' | 'xiaohongshu' | 'bilibili' | 'unknown';
type FailReason =
  | 'invalid_input'
  | 'parse_rejected'
  | 'upstream_unavailable'
  | 'timeout'
  | 'rate_limited'
  | 'unknown';

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const traceId = randomUUID();
  let platform: Platform = 'unknown';
  const rateLimitResult = applyRateLimit({
    key: getRateLimitKey(request, 'api_parse'),
    maxRequests: readPositiveInt(process.env.PARSE_RATE_LIMIT_MAX, 30),
    windowMs: readPositiveInt(process.env.PARSE_RATE_LIMIT_WINDOW_MS, 60_000),
  });
  const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

  if (!rateLimitResult.allowed) {
    await trackServerEvent({
      event: 'parse_fail',
      distinctId: traceId,
      properties: {
        platform,
        status_code: 429,
        fail_reason: 'rate_limited',
        duration_ms: Date.now() - startedAt,
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Too many requests, please try again later.',
      },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders,
          'Retry-After': String(rateLimitResult.retryAfterSeconds),
        },
      }
    );
  }

  try {
    const body = (await request.json()) as { url?: string };
    const url = typeof body?.url === 'string' ? body.url.trim() : '';

    if (!url) {
      await trackServerEvent({
        event: 'parse_fail',
        distinctId: traceId,
        properties: {
          platform,
          status_code: 400,
          fail_reason: 'invalid_input',
          duration_ms: Date.now() - startedAt,
        },
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Please provide a valid link.',
        },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    platform = detectPlatform(url);
    await trackServerEvent({
      event: 'parse_submit',
      distinctId: traceId,
      properties: {
        platform,
      },
    });

    let result: ParseResult;
    let mode: 'backend' | 'no-cookie';

    switch (platform) {
      case 'douyin': {
        result = await parseDouyinNoCookie(url);
        mode = 'no-cookie';
        break;
      }

      case 'xiaohongshu': {
        try {
          result = await parseWithBackend(url, platform);
          mode = 'backend';
        } catch (backendError: unknown) {
          try {
            result = await parseXiaohongshuNoCookie(url);
            mode = 'no-cookie';
          } catch (xhsError: unknown) {
            if (isXiaohongshuUnsupportedByHybridBackend(backendError)) {
              throw xhsError;
            }

            const backendMessage = getErrorMessage(backendError, 'Backend parse failed');
            const xhsMessage = getErrorMessage(xhsError, 'No-cookie parse failed');
            throw new Error(`${backendMessage}; ${xhsMessage}`);
          }
        }
        break;
      }

      case 'kuaishou': {
        try {
          result = await parseKuaishouNoCookie(url);
          mode = 'no-cookie';
        } catch (noCookieError: unknown) {
          try {
            result = await parseKuaishouWithBackend(url);
            mode = 'backend';
          } catch (backendError: unknown) {
            const noCookieMessage = getErrorMessage(noCookieError, 'No-cookie parse failed');
            const backendMessage = getErrorMessage(backendError, 'Kuaishou backend parse failed');
            throw new Error(`${noCookieMessage}; ${backendMessage}`);
          }
        }
        break;
      }

      case 'tiktok':
      case 'bilibili': {
        result = await parseWithBackend(url, platform);
        mode = 'backend';
        break;
      }

      default:
        throw new Error(`Unsupported platform: ${url}`);
    }

    await trackServerEvent({
      event: 'parse_success',
      distinctId: traceId,
      properties: {
        platform,
        result_type: result.type,
        mode,
        status_code: 200,
        duration_ms: Date.now() - startedAt,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        mode,
        platform,
      },
      { headers: rateLimitHeaders }
    );
  } catch (error: unknown) {
    const message = getErrorMessage(error, 'Parse failed');
    const status = getErrorStatus(message);

    console.error('[parse] error:', message);

    await trackServerEvent({
      event: 'parse_fail',
      distinctId: traceId,
      properties: {
        platform,
        status_code: status,
        fail_reason: mapFailReason(message, status),
        duration_ms: Date.now() - startedAt,
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status, headers: rateLimitHeaders }
    );
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return fallback;
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function getErrorStatus(message: string): number {
  const lower = message.toLowerCase();

  if (lower.includes('too many requests')) {
    return 429;
  }

  if (
    lower.includes('please provide') ||
    lower.includes('invalid') ||
    lower.includes('unsupported') ||
    lower.includes('not support')
  ) {
    return 400;
  }

  if (
    lower.includes('failed to extract') ||
    lower.includes('failed to retrieve') ||
    lower.includes('unable to extract') ||
    lower.includes('not found')
  ) {
    return 422;
  }

  if (lower.includes('timeout')) {
    return 504;
  }

  if (
    lower.includes('api error') ||
    lower.includes('fetch failed') ||
    lower.includes('econnrefused') ||
    lower.includes('service unavailable')
  ) {
    return 503;
  }

  return 500;
}

function mapFailReason(message: string, status: number): FailReason {
  const lower = message.toLowerCase();

  if (status === 429 || lower.includes('too many requests')) {
    return 'rate_limited';
  }

  if (
    status === 400 ||
    lower.includes('please provide') ||
    lower.includes('invalid') ||
    lower.includes('unsupported')
  ) {
    return 'invalid_input';
  }

  if (
    status === 422 ||
    lower.includes('failed to extract') ||
    lower.includes('failed to retrieve') ||
    lower.includes('unable to extract')
  ) {
    return 'parse_rejected';
  }

  if (
    status === 503 ||
    lower.includes('api error') ||
    lower.includes('fetch failed') ||
    lower.includes('econnrefused')
  ) {
    return 'upstream_unavailable';
  }

  if (status === 504 || lower.includes('timeout')) {
    return 'timeout';
  }

  return 'unknown';
}

function detectPlatform(url: string): Platform {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('douyin.com') || lowerUrl.includes('v.douyin.com')) {
    return 'douyin';
  }
  if (lowerUrl.includes('tiktok.com') || lowerUrl.includes('vm.tiktok.com')) {
    return 'tiktok';
  }
  if (
    lowerUrl.includes('kuaishou.com') ||
    lowerUrl.includes('v.kuaishou.com') ||
    lowerUrl.includes('kuaishou.cn') ||
    lowerUrl.includes('live.kuaishou.com')
  ) {
    return 'kuaishou';
  }
  if (lowerUrl.includes('xiaohongshu.com') || lowerUrl.includes('xhslink.com')) {
    return 'xiaohongshu';
  }
  if (lowerUrl.includes('bilibili.com') || lowerUrl.includes('b23.tv')) {
    return 'bilibili';
  }

  return 'unknown';
}

async function parseDouyinNoCookie(url: string): Promise<ParseResult> {
  const { extractIdFromUrl, parseDouyinNoCookie: parse, transformNoCookieResult } =
    await import('@/lib/no_cookie_parser');

  // Keep full short-link path (including "_" and "-"), avoid truncating the token.
  const urlRegex = /(https?:\/\/)?(v\.douyin\.com|douyin\.com)\/[^\s?#]+/i;
  const match = url.match(urlRegex);
  let cleanUrl = url;

  if (match?.[0]) {
    cleanUrl = match[0];
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    if (!cleanUrl.endsWith('/')) {
      cleanUrl += '/';
    }
  }

  const id = await extractIdFromUrl(cleanUrl);
  if (!id) {
    throw new Error('Failed to extract video ID');
  }

  const data = await parse(id);
  if (!data) {
    throw new Error('Parse failed');
  }

  return transformNoCookieResult(data);
}

async function parseWithBackend(url: string, platform: string): Promise<ParseResult> {
  const backendUrl = process.env.DOUYIN_API_URL || 'http://localhost:8080';
  const params = new URLSearchParams({
    url,
    minimal: 'false',
  });

  const response = await fetch(`${backendUrl}/api/hybrid/video_data?${params.toString()}`);

  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch {
      // ignore
    }
    throw new Error(`Backend API error: ${response.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`);
  }

  const apiData: unknown = await response.json();
  return transformBackendData(apiData, platform);
}

async function parseKuaishouWithBackend(url: string): Promise<ParseResult> {
  const backendUrl = process.env.KUAISHOU_API_URL || 'http://localhost:5557';
  const cookie = process.env.KUAISHOU_COOKIE || '';
  const proxy = process.env.KUAISHOU_PROXY || '';

  const payload: Record<string, string> = { text: url };
  if (cookie) {
    payload.cookie = cookie;
  }
  if (proxy) {
    payload.proxy = proxy;
  }

  const response = await fetch(`${backendUrl}/detail/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch {
      // ignore
    }
    throw new Error(`Kuaishou backend API error: ${response.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`);
  }

  const apiData = (await response.json()) as AnyObject;
  if (!apiData?.data) {
    throw new Error(
      pickFirstString(apiData, ['message', 'detail']) ||
        'Failed to extract Kuaishou post details'
    );
  }

  return transformKuaishouBackendData(apiData.data);
}

function transformBackendData(apiData: unknown, platform: string): ParseResult {
  if (platform === 'xiaohongshu') {
    return transformXiaohongshuBackendData(apiData);
  }

  const root = asObject(apiData);
  const awemeDetail = asObject(root?.data);
  if (!awemeDetail) {
    throw new Error('Backend API returned an invalid payload.');
  }

  const video = asObject(awemeDetail.video);
  const author = asObject(awemeDetail.author);
  const desc = pickFirstString(awemeDetail, ['desc', 'title']) || `${platform} content`;

  const rawImages = asArray(awemeDetail.images) || [];
  const images = rawImages
    .map((item) => {
      const itemObj = asObject(item);
      if (!itemObj) {
        return '';
      }
      return sanitizeMediaUrl(extractUrlFromUnknown(itemObj.url_list) || pickFirstString(itemObj, ['url']));
    })
    .filter((item): item is string => Boolean(item));

  if (images.length > 0) {
    return {
      type: 'images',
      title: desc,
      cover: images[0] || '',
      author: {
        name: pickFirstString(author, ['nickname']) || 'Unknown user',
        avatar: sanitizeMediaUrl(extractUrlFromUnknown(asObject(author?.avatar_thumb)?.url_list)),
      },
      images,
    };
  }

  const playUrl = firstNonEmpty([
    extractUrlFromUnknown(asObject(video?.play_addr)?.url_list),
    extractUrlFromUnknown(asObject(asArray(video?.bit_rate)?.[0])?.play_addr),
  ]);

  const noWatermarkUrl = sanitizeMediaUrl(playUrl.replace('playwm', 'play'));
  if (!noWatermarkUrl) {
    throw new Error('Failed to extract video resource');
  }

  return {
    type: 'video',
    title: desc,
    cover: sanitizeMediaUrl(extractUrlFromUnknown(asObject(video?.cover)?.url_list)),
    author: {
      name: pickFirstString(author, ['nickname']) || 'Unknown user',
      avatar: sanitizeMediaUrl(extractUrlFromUnknown(asObject(author?.avatar_thumb)?.url_list)),
    },
    videoUrl: noWatermarkUrl,
  };
}

function transformKuaishouBackendData(apiData: unknown): ParseResult {
  const dataObj = asObject(apiData);
  const root = asObject(dataObj?.data) ?? dataObj;

  if (!root) {
    throw new Error('Failed to extract Kuaishou post details');
  }

  const title = pickFirstString(root, ['caption', 'title', 'desc']) || 'Kuaishou post';
  const authorName = pickFirstString(root, ['name', 'userName']) || 'Unknown user';
  const authorAvatar = sanitizeMediaUrl(pickMediaValue(root, ['headUrls', 'avatar', 'avatarUrl', 'headUrl']));

  const mediaUrls = extractKuaishouDownloadUrls(root)
    .map((item) => sanitizeMediaUrl(item))
    .filter((item): item is string => Boolean(item));

  const cover = sanitizeMediaUrl(
    firstNonEmpty([pickMediaValue(root, ['coverUrl', 'coverUrls', 'webpCoverUrls', 'cover']), mediaUrls[0] || ''])
  );

  const rawType = pickFirstString(root, ['photoType', 'type']).toLowerCase();
  const isImagePost =
    mediaUrls.length > 1 ||
    rawType.includes('image') ||
    rawType.includes('atlas') ||
    Boolean(asArray(asObject(root.atlas)?.list)?.length);

  if (isImagePost) {
    const images = mediaUrls.length > 0 ? mediaUrls : cover ? [cover] : [];

    if (images.length === 0) {
      throw new Error('Failed to extract Kuaishou image resources');
    }

    return {
      type: 'images',
      title,
      cover: cover || images[0] || '',
      author: {
        name: authorName,
        avatar: authorAvatar || '',
      },
      images,
    };
  }

  const videoUrl =
    mediaUrls[0] ||
    sanitizeMediaUrl(pickMediaValue(root, ['mp4Url', 'photoUrl', 'videoUrl']));

  if (!videoUrl) {
    throw new Error('Failed to extract Kuaishou video resource');
  }

  return {
    type: 'video',
    title,
    cover: cover || '',
    author: {
      name: authorName,
      avatar: authorAvatar || '',
    },
    videoUrl,
  };
}

function extractKuaishouDownloadUrls(payload: unknown): string[] {
  const root = asObject(payload);
  const download = root?.download;

  if (Array.isArray(download)) {
    return download
      .map((item) => extractUrlFromUnknown(item))
      .filter((item): item is string => Boolean(item));
  }

  if (typeof download === 'string' && download.trim()) {
    return download
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (download && typeof download === 'object') {
    const fromObject = extractUrlFromUnknown(download);
    return fromObject ? [fromObject] : [];
  }

  return [];
}

function transformXiaohongshuBackendData(apiData: unknown): ParseResult {
  const root = asObject(asObject(apiData)?.data) ?? asObject(apiData);
  if (!root) {
    throw new Error('Xiaohongshu backend returned an empty payload.');
  }

  const payloadCandidates: unknown[] = [
    root,
    root.data,
    root.note,
    root.note_info,
    root.noteInfo,
    root.note_card,
    root.noteCard,
    root.item,
    Array.isArray(root.items) ? root.items[0] : null,
  ].filter(Boolean);

  const payload = payloadCandidates.find((item) => hasAnyMedia(item)) ?? root;

  const title =
    pickFirstString(payload, ['title', 'desc', 'note_desc', 'content']) ||
    pickFirstString(root, ['title', 'desc']) ||
    'Xiaohongshu content';

  const authorName =
    pickFirstString(asObject(payload)?.author, ['nickname', 'name']) ||
    pickFirstString(asObject(payload)?.user, ['nickname', 'name']) ||
    pickFirstString(root.author, ['nickname', 'name']) ||
    'Unknown user';

  const authorAvatar = sanitizeMediaUrl(
    firstNonEmpty([
      pickMediaValue(asObject(payload)?.author, ['avatar', 'avatar_url', 'image']),
      pickMediaValue(asObject(payload)?.user, ['avatar', 'avatar_url', 'image']),
    ])
  );

  const images = extractXhsImages(payload)
    .map((item) => sanitizeMediaUrl(item))
    .filter((item): item is string => Boolean(item));

  const videoUrl = sanitizeMediaUrl(extractXhsVideoUrl(payload));
  const cover = images[0] || sanitizeMediaUrl(extractXhsCover(payload));

  if (images.length > 0) {
    return {
      type: 'images',
      title,
      cover: cover || '',
      author: {
        name: authorName,
        avatar: authorAvatar || '',
      },
      images,
    };
  }

  if (videoUrl) {
    return {
      type: 'video',
      title,
      cover: cover || '',
      author: {
        name: authorName,
        avatar: authorAvatar || '',
      },
      videoUrl,
    };
  }

  throw new Error('No image or video resource found in Xiaohongshu backend response.');
}

function hasAnyMedia(obj: unknown): boolean {
  return extractXhsImages(obj).length > 0 || Boolean(extractXhsVideoUrl(obj));
}

function extractXhsImages(obj: unknown): string[] {
  const root = asObject(obj);
  if (!root) {
    return [];
  }

  const list = [
    ...(asArray(root.images) || []),
    ...(asArray(root.imageList) || []),
    ...(asArray(root.image_list) || []),
    ...(asArray(root.note_image_list) || []),
    ...(asArray(root.photos) || []),
  ];

  const urls = new Set<string>();

  for (const item of list) {
    if (!item) {
      continue;
    }

    if (typeof item === 'string') {
      urls.add(item);
      continue;
    }

    const itemObj = asObject(item);
    if (!itemObj) {
      continue;
    }

    const url = firstNonEmpty([
      pickFirstString(itemObj, ['url', 'urlDefault', 'masterUrl']),
      extractUrlFromUnknown(itemObj.url_list),
      extractUrlFromUnknown(itemObj.info_list),
    ]);

    if (url) {
      urls.add(url);
    }
  }

  return Array.from(urls);
}

function extractXhsVideoUrl(obj: unknown): string {
  const root = asObject(obj);
  if (!root) {
    return '';
  }

  return firstNonEmpty([
    pickFirstString(root, ['video_url', 'videoUrl']),
    pickFirstString(root.video, ['url', 'masterUrl']),
    pickFirstString(asObject(asObject(root.video)?.media), ['url']),
    pickFirstString(asObject(asObject(asObject(root.video)?.media)?.stream), ['url', 'masterUrl']),
    extractUrlFromUnknown(asArray(asObject(asObject(asObject(root.video)?.media)?.stream)?.h264)?.[0]),
    extractUrlFromUnknown(asArray(asObject(asObject(asObject(root.video)?.media)?.stream)?.h265)?.[0]),
    extractUrlFromUnknown(asObject(asObject(root.video)?.play_addr)?.url_list),
  ]);
}

function extractXhsCover(obj: unknown): string {
  const root = asObject(obj);
  if (!root) {
    return '';
  }

  return firstNonEmpty([
    pickFirstString(root.cover, ['url', 'urlDefault']),
    pickFirstString(root, ['cover', 'image']),
  ]);
}

function pickMediaValue(target: unknown, keys: string[]): string {
  const root = asObject(target);
  if (!root) {
    return '';
  }

  for (const key of keys) {
    const value = root[key];
    const extracted = extractUrlFromUnknown(value);
    if (extracted) {
      return extracted;
    }
  }

  return '';
}

function pickFirstString(target: unknown, keys: string[]): string {
  const root = asObject(target);
  if (!root) {
    return '';
  }

  for (const key of keys) {
    const value = root[key];
    if (typeof value === 'string' && value) {
      return value;
    }
  }

  return '';
}

function extractUrlFromUnknown(value: unknown): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractUrlFromUnknown(item);
      if (extracted) {
        return extracted;
      }
    }
    return '';
  }

  const obj = asObject(value);
  if (!obj) {
    return '';
  }

  return (
    pickFirstString(obj, ['url', 'uri', 'masterUrl', 'photoUrl', 'originUrl']) ||
    extractUrlFromUnknown(obj.url_list) ||
    extractUrlFromUnknown(obj.info_list)
  );
}

function firstNonEmpty(values: string[]): string {
  for (const value of values) {
    if (value) {
      return value;
    }
  }
  return '';
}

function sanitizeMediaUrl(url: string): string {
  if (!url) {
    return '';
  }

  try {
    const parsed = new URL(url);
    const process = parsed.searchParams.get('x-oss-process');
    if (process && /watermark/i.test(process)) {
      parsed.searchParams.delete('x-oss-process');
    }
    if (/watermark/i.test(parsed.search)) {
      parsed.search = '';
    }
    return parsed.toString();
  } catch {
    return url.replace(/([?&])x-oss-process=[^&]+/i, '').replace(/[?&]$/, '');
  }
}

function asObject(value: unknown): AnyObject | null {
  return value && typeof value === 'object' ? (value as AnyObject) : null;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function isXiaohongshuUnsupportedByHybridBackend(error: unknown): boolean {
  const message = getErrorMessage(error, '');
  return (
    message.includes('Backend API error: 400') ||
    message.includes('Backend API error: 404')
  );
}

