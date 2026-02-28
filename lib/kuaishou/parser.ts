import type { ImagesResult, ParseResult, VideoResult } from '@/types';

type AnyObject = Record<string, unknown>;

const KUAISHOU_HEADERS: HeadersInit = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  Referer: 'https://www.kuaishou.com/',
};

interface ResolvedResult {
  finalUrl: string;
  html: string;
}

export async function parseKuaishouNoCookie(rawUrl: string): Promise<ParseResult> {
  const { finalUrl, html: resolvedHtml } = await resolveFinalUrl(rawUrl);
  const pageHtml = resolvedHtml || (await fetchHtml(finalUrl));
  const initState = extractInitState(pageHtml);
  const payload = findMediaPayload(initState);

  if (!payload) {
    throw new Error('未提取到快手作品详情');
  }

  return transformPayload(payload);
}

async function resolveFinalUrl(rawUrl: string): Promise<ResolvedResult> {
  const normalized = normalizeUrl(rawUrl);
  let currentUrl = normalized;

  for (let hop = 0; hop < 8; hop += 1) {
    const response = await fetch(currentUrl, {
      headers: KUAISHOU_HEADERS,
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        break;
      }
      currentUrl = absolutizeUrl(currentUrl, location);
      continue;
    }

    const html = await response.text();
    const embeddedUrl = extractKuaishouUrlFromText(html);
    if (embeddedUrl && embeddedUrl !== currentUrl) {
      currentUrl = embeddedUrl;
      continue;
    }

    return {
      finalUrl: response.url || currentUrl,
      html,
    };
  }

  const fallback = await fetch(normalized, {
    headers: KUAISHOU_HEADERS,
    redirect: 'follow',
  });

  return {
    finalUrl: fallback.url || normalized,
    html: await fallback.text(),
  };
}

function extractKuaishouUrlFromText(text: string): string {
  if (!text) {
    return '';
  }

  const redirectPattern =
    /(?:window\.location(?:\.href|\.replace)?\s*=\s*|location\.replace\()\s*['"]([^'"]+)['"]/i;
  const redirectMatch = text.match(redirectPattern);
  if (redirectMatch?.[1]) {
    const url = decodeEmbeddedUrl(redirectMatch[1]);
    if (isKuaishouUrl(url)) {
      return url;
    }
  }

  const plainMatch = text.match(
    /https?:\/\/(?:v\.kuaishou\.com|www\.kuaishou\.com|live\.kuaishou\.com|kuaishou\.com)\/[^\s"'<>]+/i
  );
  if (plainMatch?.[0]) {
    return decodeEmbeddedUrl(plainMatch[0]);
  }

  const escapedMatch = text.match(
    /https?:\\\/\\\/(?:v\.kuaishou\.com|www\.kuaishou\.com|live\.kuaishou\.com|kuaishou\.com)\\\/[^"'<>]+/i
  );
  if (escapedMatch?.[0]) {
    return decodeEmbeddedUrl(escapedMatch[0].replace(/\\\//g, '/'));
  }

  return '';
}

function decodeEmbeddedUrl(raw: string): string {
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    // ignore
  }

  value = value.replace(/\\u002F/g, '/').replace(/\\\//g, '/');
  if (value.startsWith('http%3A') || value.startsWith('https%3A')) {
    try {
      value = decodeURIComponent(value);
    } catch {
      // ignore
    }
  }

  return value;
}

function isKuaishouUrl(url: string): boolean {
  return /https?:\/\/(?:v\.kuaishou\.com|(?:www\.)?kuaishou\.com|live\.kuaishou\.com)\//i.test(url);
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: KUAISHOU_HEADERS,
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`快手页面请求失败: HTTP ${response.status}`);
  }

  return response.text();
}

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/[)\]}>，。,！!？?;；]+$/g, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function absolutizeUrl(base: string, maybeRelative: string): string {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

function extractInitState(html: string): AnyObject {
  const markers = ['window.INIT_STATE = ', 'window.INIT_STATE='];
  let jsonText: string | null = null;

  for (const marker of markers) {
    jsonText = extractJsonByMarker(html, marker);
    if (jsonText) {
      break;
    }
  }

  if (!jsonText) {
    throw new Error('页面中未找到 INIT_STATE');
  }

  try {
    return JSON.parse(jsonText) as AnyObject;
  } catch {
    throw new Error('INIT_STATE 解析失败');
  }
}

function extractJsonByMarker(content: string, marker: string): string | null {
  const markerIndex = content.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const jsonStart = content.indexOf('{', markerIndex + marker.length);
  if (jsonStart === -1) {
    return null;
  }

  let bracketCount = 0;
  let inString = false;
  let escaped = false;

  for (let i = jsonStart; i < content.length; i += 1) {
    const char = content[i];
    if (!char) {
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      bracketCount += 1;
      continue;
    }

    if (char === '}') {
      bracketCount -= 1;
      if (bracketCount === 0) {
        return content.slice(jsonStart, i + 1);
      }
    }
  }

  return null;
}

function findMediaPayload(initState: AnyObject): AnyObject | null {
  const queue: unknown[] = [initState];
  const visited = new Set<unknown>();
  let bestCandidate: AnyObject | null = null;
  let bestScore = 0;
  let level = 0;

  while (queue.length > 0 && level < 10) {
    const levelSize = queue.length;
    for (let i = 0; i < levelSize; i += 1) {
      const current = queue.shift();
      if (!current || typeof current !== 'object' || visited.has(current)) {
        continue;
      }

      visited.add(current);
      const candidate = current as AnyObject;
      const score = scorePayload(candidate);

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }

      for (const value of Object.values(candidate)) {
        if (value && typeof value === 'object') {
          queue.push(value);
        }
      }
    }

    level += 1;
  }

  return bestScore >= 6 ? bestCandidate : null;
}

function scorePayload(payload: AnyObject): number {
  let score = 0;
  const photo = asObject(payload.photo);

  if (photo) {
    score += 4;
  }
  if (extractAtlasUrls(payload).length > 0) {
    score += 4;
  }
  if (extractVideoUrl(payload)) {
    score += 3;
  }

  if (asString(photo?.caption) || asString(payload.caption) || asString(payload.title)) {
    score += 1;
  }
  if (asString(photo?.photoType) || asString(payload.photoType)) {
    score += 1;
  }
  if (extractFirstUrl(photo?.coverUrls) || extractFirstUrl(payload.coverUrls)) {
    score += 1;
  }
  if (asString(photo?.photoId) || asString(payload.photoId) || asString(payload.detailID)) {
    score += 1;
  }

  return score;
}

function transformPayload(payload: AnyObject): ParseResult {
  const photo = asObject(payload.photo) ?? payload;
  const title =
    firstNonEmpty([
      asString(photo.caption),
      asString(photo.title),
      asString(photo.desc),
      asString(payload.caption),
      asString(payload.title),
    ]) || '快手作品';
  const authorName =
    firstNonEmpty([
      asString(photo.userName),
      asString(payload.userName),
      asString(payload.name),
      asString(asObject(payload.author)?.name),
    ]) || '未知用户';

  const authorAvatar = sanitizeMediaUrl(
    firstNonEmpty([
      extractFirstUrl(photo.headUrls),
      extractFirstUrl(payload.headUrls),
      asString(photo.headUrl),
      asString(payload.headUrl),
      asString(asObject(payload.author)?.avatar),
    ])
  );

  const cover = sanitizeMediaUrl(
    firstNonEmpty([
      extractFirstUrl(photo.coverUrls),
      extractFirstUrl(photo.webpCoverUrls),
      asString(photo.coverUrl),
      extractFirstUrl(payload.coverUrls),
      asString(payload.coverUrl),
      asString(payload.cover),
    ])
  );

  const photoType = firstNonEmpty([asString(photo.photoType), asString(payload.photoType)]).toUpperCase();
  const atlasUrls = compactUrls(extractAtlasUrls(payload).map((item) => sanitizeMediaUrl(item)));
  const isImagePost =
    atlasUrls.length > 0 ||
    photoType.includes('ATLAS') ||
    photoType.includes('IMAGE') ||
    photoType.includes('PHOTO');

  if (isImagePost) {
    const images = atlasUrls.length > 0 ? atlasUrls : cover ? [cover] : [];
    if (images.length === 0) {
      throw new Error('未提取到快手图片资源');
    }

    const result: ImagesResult = {
      type: 'images',
      title,
      cover: cover || images[0] || '',
      images,
      author: {
        name: authorName,
        avatar: authorAvatar || '',
      },
    };
    return result;
  }

  const videoUrl = sanitizeMediaUrl(extractVideoUrl(payload));
  if (!videoUrl) {
    throw new Error('未提取到快手视频资源');
  }

  const result: VideoResult = {
    type: 'video',
    title,
    cover: cover || '',
    videoUrl,
    author: {
      name: authorName,
      avatar: authorAvatar || '',
    },
  };
  return result;
}

function extractAtlasUrls(payload: AnyObject): string[] {
  const photo = asObject(payload.photo);
  const extParams = asObject(photo?.ext_params) ?? asObject(payload.ext_params);
  const atlasCandidates = [
    asObject(payload.atlas),
    asObject(photo?.atlas),
    asObject(extParams?.atlas),
  ].filter((item): item is AnyObject => Boolean(item));

  const urls = new Set<string>();

  for (const atlas of atlasCandidates) {
    const list = asArray(atlas.list);
    if (!list || list.length === 0) {
      continue;
    }

    const cdn = pickAtlasCdn(atlas);
    for (const item of list) {
      if (typeof item === 'string') {
        const value = item.trim();
        if (!value) {
          continue;
        }
        if (isAbsoluteUrl(value)) {
          urls.add(value);
          continue;
        }
        if (cdn) {
          urls.add(buildCdnUrl(cdn, value));
        }
        continue;
      }

      const itemObj = asObject(item);
      if (!itemObj) {
        continue;
      }

      const raw = firstNonEmpty([
        asString(itemObj.url),
        asString(itemObj.photoUrl),
        asString(itemObj.originUrl),
        asString(itemObj.path),
        asString(itemObj.suffix),
      ]);

      if (!raw) {
        continue;
      }
      if (isAbsoluteUrl(raw)) {
        urls.add(raw);
        continue;
      }
      if (cdn) {
        urls.add(buildCdnUrl(cdn, raw));
      }
    }
  }

  return Array.from(urls);
}

function pickAtlasCdn(atlas: AnyObject): string {
  const cdnArray = asArray(atlas.cdn);
  if (cdnArray?.length) {
    const first = asString(cdnArray[0]).trim();
    if (first) {
      return first;
    }
  }

  const cdnList = asArray(atlas.cdnList);
  if (cdnList?.length) {
    const firstObj = asObject(cdnList[0]);
    const first = firstObj ? firstNonEmpty([asString(firstObj.cdn), asString(firstObj.url)]) : '';
    if (first) {
      return first;
    }
  }

  return '';
}

function buildCdnUrl(cdn: string, path: string): string {
  const normalizedCdn = cdn.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `https://${normalizedCdn}${normalizedPath}`;
}

function extractVideoUrl(payload: AnyObject): string {
  const photo = asObject(payload.photo);
  const candidates = [
    asString(payload.mp4Url),
    asString(photo?.mp4Url),
    extractFirstUrl(photo?.mainMvUrls),
    extractFirstUrl(payload.mainMvUrls),
    extractFirstUrl(photo?.photoUrl),
    extractFirstUrl(payload.photoUrl),
    asString(photo?.photoUrl),
    asString(payload.photoUrl),
    asString(asObject(photo?.manifest)?.url),
    asString(asObject(payload.video)?.url),
  ];

  return firstNonEmpty(candidates);
}

function extractFirstUrl(value: unknown): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = extractFirstUrl(item);
      if (parsed) {
        return parsed;
      }
    }
    return '';
  }

  if (typeof value === 'object') {
    const obj = value as AnyObject;
    return (
      asString(obj.url) ||
      asString(obj.photoUrl) ||
      asString(obj.originUrl) ||
      asString(obj.main) ||
      ''
    );
  }

  return '';
}

function compactUrls(urls: string[]): string[] {
  const unique = new Set<string>();
  for (const item of urls) {
    if (!item) {
      continue;
    }
    unique.add(item);
  }
  return Array.from(unique);
}

function firstNonEmpty(candidates: string[]): string {
  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }
  return '';
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
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

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
