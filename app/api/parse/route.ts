import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import type { ParseResult } from '@/types';
import { parseXiaohongshuNoCookie } from '@/lib/xiaohongshu/parser';
import { parseKuaishouNoCookie } from '@/lib/kuaishou/parser';
import { trackServerEvent } from '@/lib/serverAnalytics';

type AnyObject = Record<string, unknown>;
type Platform = 'douyin' | 'tiktok' | 'kuaishou' | 'xiaohongshu' | 'bilibili' | 'unknown';
type FailReason = 'invalid_input' | 'parse_rejected' | 'upstream_unavailable' | 'timeout' | 'unknown';

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const traceId = randomUUID();
  let platform: Platform = 'unknown';

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
      return NextResponse.json({ error: '请提供链接' }, { status: 400 });
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
        throw new Error(`暂不支持该平台: ${url}`);
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

    return NextResponse.json({
      success: true,
      data: result,
      mode,
      platform,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error, '解析失败');
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
      { status }
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

function getErrorStatus(message: string): number {
  if (message.includes('请提供链接') || message.includes('暂不支持')) {
    return 400;
  }

  if (
    message.includes('无法从') ||
    message.includes('未提取到') ||
    message.includes('提取作品链接失败') ||
    message.includes('获取作品数据失败') ||
    message.includes('Failed to extract works link') ||
    message.includes('Failed to retrieve works data') ||
    message.includes('无效') ||
    message.includes('仅支持在小红书 APP 内查看')
  ) {
    return 422;
  }

  if (
    message.includes('后端API错误') ||
    message.includes('快手后端API错误') ||
    message.includes('fetch failed') ||
    message.includes('ECONNREFUSED')
  ) {
    return 503;
  }

  return 500;
}

function mapFailReason(message: string, status: number): FailReason {
  const lower = message.toLowerCase();

  if (
    status === 400 ||
    lower.includes('请提供链接') ||
    lower.includes('暂不支持') ||
    lower.includes('请输入') ||
    lower.includes('无效')
  ) {
    return 'invalid_input';
  }

  if (
    status === 422 ||
    lower.includes('无法从') ||
    lower.includes('未提取到') ||
    lower.includes('提取') ||
    lower.includes('仅支持在小红书 app')
  ) {
    return 'parse_rejected';
  }

  if (
    status === 503 ||
    lower.includes('后端api错误') ||
    lower.includes('快手后端api错误') ||
    lower.includes('fetch failed') ||
    lower.includes('econnrefused')
  ) {
    return 'upstream_unavailable';
  }

  if (lower.includes('timeout') || lower.includes('超时')) {
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
    throw new Error('无法提取视频ID');
  }

  const data = await parse(id);
  if (!data) {
    throw new Error('解析失败');
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
    throw new Error(`后端API错误: ${response.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`);
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
    throw new Error(`快手后端API错误: ${response.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`);
  }

  const apiData = (await response.json()) as AnyObject;
  if (!apiData?.data) {
    throw new Error(
      pickFirstString(apiData, ['message', 'detail']) ||
        '未提取到快手作品详情'
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
    throw new Error('API 返回数据格式不正确');
  }

  const video = asObject(awemeDetail.video);
  const author = asObject(awemeDetail.author);
  const desc = pickFirstString(awemeDetail, ['desc', 'title']) || `${platform}内容`;

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
        name: pickFirstString(author, ['nickname']) || '未知用户',
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
    throw new Error('未提取到视频资源');
  }

  return {
    type: 'video',
    title: desc,
    cover: sanitizeMediaUrl(extractUrlFromUnknown(asObject(video?.cover)?.url_list)),
    author: {
      name: pickFirstString(author, ['nickname']) || '未知用户',
      avatar: sanitizeMediaUrl(extractUrlFromUnknown(asObject(author?.avatar_thumb)?.url_list)),
    },
    videoUrl: noWatermarkUrl,
  };
}

function transformKuaishouBackendData(apiData: unknown): ParseResult {
  const dataObj = asObject(apiData);
  const root = asObject(dataObj?.data) ?? dataObj;

  if (!root) {
    throw new Error('未提取到快手作品详情');
  }

  const title = pickFirstString(root, ['caption', 'title', 'desc']) || '快手作品';
  const authorName = pickFirstString(root, ['name', 'userName']) || '未知用户';
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
    rawType.includes('图') ||
    rawType.includes('atlas') ||
    Boolean(asArray(asObject(root.atlas)?.list)?.length);

  if (isImagePost) {
    const images = mediaUrls.length > 0 ? mediaUrls : cover ? [cover] : [];

    if (images.length === 0) {
      throw new Error('未提取到快手图片资源');
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
    throw new Error('未提取到快手视频资源');
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
    throw new Error('小红书后端返回为空');
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
    '未知用户';

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

  throw new Error('小红书后端返回中未找到图片或视频资源');
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
    message.includes('后端API错误: 400') ||
    message.includes('后端API错误: 404')
  );
}
