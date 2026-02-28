import { NextRequest, NextResponse } from 'next/server';
import { ErrorCode, type ParseResult } from '@/types';
import { parseXiaohongshuNoCookie } from '@/lib/xiaohongshu/parser';
import { parseKuaishouNoCookie } from '@/lib/kuaishou/parser';
import { getBillingConfig } from '@/lib/billing/config';
import {
  applyIdentityCookie,
  resolveRequestIdentity,
  type RequestIdentity,
} from '@/lib/billing/identity';
import { consumeUsage, evaluateQuota, recordSoftLimitedUsage } from '@/lib/billing/quota';

type AnyObject = Record<string, unknown>;

export async function POST(request: NextRequest) {
  let identity: RequestIdentity | null = null;
  const billingConfig = getBillingConfig();

  try {
    identity = await resolveRequestIdentity(request);
    const body = (await request.json()) as { url?: string };
    const url = typeof body?.url === 'string' ? body.url.trim() : '';

    if (!url) {
      return createErrorResponse({
        code: ErrorCode.INVALID_URL,
        message: '请提供链接',
        status: 400,
        identity,
      });
    }

    const platform = detectPlatform(url);
    if (platform === 'unknown') {
      return createErrorResponse({
        code: ErrorCode.INVALID_URL,
        message: `暂不支持该平台: ${url}`,
        status: 400,
        identity,
      });
    }

    const quotaDecision = await evaluateQuota(identity.userId, identity.anonId);
    if (!quotaDecision.allowed && quotaDecision.requiresPaywall) {
      return createErrorResponse({
        code: ErrorCode.PAYWALL_REQUIRED,
        message: '今日免费次数已用完',
        status: 402,
        details: {
          variant: quotaDecision.snapshot.variant,
          freeDailyLimit: quotaDecision.snapshot.freeDailyLimit,
          freeRemaining: quotaDecision.snapshot.freeRemaining,
          plans: [
            { type: 'day', priceCents: quotaDecision.snapshot.prices.day },
            { type: 'month', priceCents: quotaDecision.snapshot.prices.month },
          ],
        },
        identity,
      });
    }

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

            const backendMessage = getErrorMessage(backendError, '后端解析失败');
            const xhsMessage = getErrorMessage(xhsError, '无 Cookie 解析失败');
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
            const noCookieMessage = getErrorMessage(noCookieError, '无 Cookie 解析失败');
            const backendMessage = getErrorMessage(backendError, '快手后端解析失败');
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
        return createErrorResponse({
          code: ErrorCode.INVALID_URL,
          message: `暂不支持该平台: ${url}`,
          status: 400,
          identity,
        });
    }

    if (billingConfig.enabled) {
      if (quotaDecision.fairUseLimited) {
        await recordSoftLimitedUsage(identity.userId);
      }
      await consumeUsage(identity.userId);
    }

    const postConsumeSnapshot = (
      await evaluateQuota(identity.userId, identity.anonId)
    ).snapshot;
    const response = NextResponse.json({
      success: true,
      data: result,
      mode,
      platform,
      billing: billingConfig.enabled
        ? {
            activePlan: postConsumeSnapshot.activePlan,
            freeRemaining: postConsumeSnapshot.freeRemaining,
            fairUseLimited: quotaDecision.fairUseLimited,
          }
        : undefined,
    });

    applyIdentityCookie(response, identity);
    return response;
  } catch (error: unknown) {
    const message = getErrorMessage(error, '解析失败');
    const status = getErrorStatus(message);

    console.error('[parse] error:', message);

    return createErrorResponse({
      code: mapErrorCode(message, status),
      message,
      status,
      identity,
    });
  }
}

function createErrorResponse(params: {
  code: string;
  message: string;
  status: number;
  details?: unknown;
  identity?: RequestIdentity | null;
}) {
  const response = NextResponse.json(
    {
      success: false,
      error: {
        code: params.code,
        message: params.message,
        details: params.details,
      },
    },
    { status: params.status }
  );

  if (params.identity) {
    applyIdentityCookie(response, params.identity);
  }

  return response;
}

function mapErrorCode(message: string, status: number): string {
  if (status === 400) {
    return ErrorCode.INVALID_URL;
  }

  if (status === 402) {
    return ErrorCode.PAYWALL_REQUIRED;
  }

  if (status === 429) {
    return ErrorCode.RATE_LIMIT_EXCEEDED;
  }

  if (status === 422) {
    return ErrorCode.PARSE_FAILED;
  }

  if (status >= 500) {
    return ErrorCode.INTERNAL_ERROR;
  }

  if (message.includes('限流') || message.toLowerCase().includes('rate limit')) {
    return ErrorCode.RATE_LIMIT_EXCEEDED;
  }

  return ErrorCode.PARSE_FAILED;
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

function getErrorStatus(message: string): number {
  const normalized = message.toLowerCase();

  if (
    message.includes('请提供') ||
    message.includes('暂不支持') ||
    normalized.includes('invalid')
  ) {
    return 400;
  }

  if (
    message.includes('Failed to extract works link') ||
    message.includes('Failed to retrieve works data') ||
    message.includes('无效') ||
    message.includes('无法提取') ||
    message.includes('未提取到')
  ) {
    return 422;
  }

  if (
    message.includes('fetch failed') ||
    message.includes('ECONNREFUSED') ||
    message.includes('后端API错误')
  ) {
    return 503;
  }

  return 500;
}

function detectPlatform(url: string): 'douyin' | 'tiktok' | 'kuaishou' | 'xiaohongshu' | 'bilibili' | 'unknown' {
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

  const urlRegex = /(https?:\/\/)?(v\.douyin\.com|douyin\.com)\/[a-zA-Z0-9\/]+/;
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
    throw new Error('鏃犳硶鎻愬彇瑙嗛ID');
  }

  const data = await parse(id);
  if (!data) {
    throw new Error('瑙ｆ瀽澶辫触');
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
    throw new Error(`鍚庣API閿欒: ${response.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`);
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
    throw new Error(`蹇墜鍚庣API閿欒: ${response.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`);
  }

  const apiData = (await response.json()) as AnyObject;
  if (!apiData?.data) {
    throw new Error(
      pickFirstString(apiData, ['message', 'detail']) ||
        '鏈彁鍙栧埌蹇墜浣滃搧璇︽儏'
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
    throw new Error('Unexpected backend payload');
  }

  const video = asObject(awemeDetail.video);
  const author = asObject(awemeDetail.author);
  const desc = pickFirstString(awemeDetail, ['desc', 'title']) || `${platform}鍐呭`;

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
        name: pickFirstString(author, ['nickname']) || '鏈煡鐢ㄦ埛',
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
    throw new Error('鏈彁鍙栧埌瑙嗛璧勬簮');
  }

  return {
    type: 'video',
    title: desc,
    cover: sanitizeMediaUrl(extractUrlFromUnknown(asObject(video?.cover)?.url_list)),
    author: {
      name: pickFirstString(author, ['nickname']) || '鏈煡鐢ㄦ埛',
      avatar: sanitizeMediaUrl(extractUrlFromUnknown(asObject(author?.avatar_thumb)?.url_list)),
    },
    videoUrl: noWatermarkUrl,
  };
}

function transformKuaishouBackendData(apiData: unknown): ParseResult {
  const dataObj = asObject(apiData);
  const root = asObject(dataObj?.data) ?? dataObj;

  if (!root) {
    throw new Error('鏈彁鍙栧埌蹇墜浣滃搧璇︽儏');
  }

  const title = pickFirstString(root, ['caption', 'title', 'desc']) || '蹇墜浣滃搧';
  const authorName = pickFirstString(root, ['name', 'userName']) || '鏈煡鐢ㄦ埛';
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
      throw new Error('鏈彁鍙栧埌蹇墜鍥剧墖璧勬簮');
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
    throw new Error('鏈彁鍙栧埌蹇墜瑙嗛璧勬簮');
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
    throw new Error('Xiaohongshu backend response is empty');
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
    '小红书内容';

  const authorName =
    pickFirstString(asObject(payload)?.author, ['nickname', 'name']) ||
    pickFirstString(asObject(payload)?.user, ['nickname', 'name']) ||
    pickFirstString(root.author, ['nickname', 'name']) ||
    '鏈煡鐢ㄦ埛';

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

  throw new Error('灏忕孩涔﹀悗绔繑鍥炰腑鏈壘鍒板浘鐗囨垨瑙嗛璧勬簮');
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
    message.includes('鍚庣API閿欒: 400') ||
    message.includes('鍚庣API閿欒: 404')
  );
}

