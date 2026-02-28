/**
 * 小红书无 Cookie 解析模块
 */

import type { ImagesResult, ParseResult, VideoResult } from '@/types';

const XHS_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  Referer: 'https://www.xiaohongshu.com/',
};

type AnyObject = Record<string, unknown>;

/**
 * 从 URL 提取 24 位笔记 ID
 */
export function extractNoteId(url: string): string | null {
  const patterns = [
    /\/explore\/([a-f0-9]{24})/i,
    /\/discovery\/item\/([a-f0-9]{24})/i,
    /\/item\/([a-f0-9]{24})/i,
    /\/sns\/note\/([a-f0-9]{24})/i,
  ];

  for (const pattern of patterns) {
    const matched = url.match(pattern);
    if (matched?.[1]) {
      return matched[1];
    }
  }

  return null;
}

/**
 * 解析小红书链接并返回统一结构
 */
export async function parseXiaohongshuNoCookie(rawUrl: string): Promise<ParseResult> {
  const { finalUrl, html: resolvedHtml } = await resolveFinalUrl(rawUrl);
  const embeddedUrl = extractXhsUrlFromText(resolvedHtml);
  const noteId =
    extractNoteId(finalUrl) ??
    extractNoteId(rawUrl) ??
    (embeddedUrl ? extractNoteId(embeddedUrl) : null);

  if (!noteId) {
    throw new Error('无法从小红书链接中提取笔记ID');
  }

  const candidateUrls = buildCandidateUrls({ finalUrl, embeddedUrl, noteId });
  const queue = [...candidateUrls];
  const visited = new Set<string>();
  let lastError: Error | null = null;
  let appOnlyCount = 0;
  let attemptCount = 0;

  while (queue.length > 0) {
    const candidateUrl = queue.shift()!;
    if (visited.has(candidateUrl)) {
      continue;
    }
    visited.add(candidateUrl);
    attemptCount += 1;

    try {
      const html = await fetchNoteHtml(candidateUrl);

      if (isAppOnlyPage(html)) {
        appOnlyCount += 1;
      }

      const initialState = extractInitialState(html);
      const noteData = findNoteData(initialState, noteId);

      if (!noteData) {
        lastError = new Error('未提取到笔记详情');

        const extraUrls = extractExtraUrlsFromState(initialState, noteId);
        for (const extraUrl of extraUrls) {
          if (!visited.has(extraUrl)) {
            queue.push(extraUrl);
          }
        }
        continue;
      }

      return transformToParseResult(noteData);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('小红书解析失败');
    }
  }

  if (attemptCount > 0 && appOnlyCount === attemptCount) {
    throw new Error('当前内容仅支持在小红书 APP 内查看，无法无Cookie解析');
  }

  throw lastError ?? new Error('未提取到笔记详情，可能需要在 APP 内查看或链接已失效');
}

interface ResolvedUrlResult {
  finalUrl: string;
  html: string;
}

async function resolveFinalUrl(rawUrl: string): Promise<ResolvedUrlResult> {
  const normalized = normalizeUrl(rawUrl);

  // 短链优先尝试 HEAD，很多场景可直接拿到 Location
  try {
    const headResponse = await fetch(normalized, {
      method: 'HEAD',
      headers: XHS_HEADERS,
      redirect: 'manual',
    });
    const headLocation = headResponse.headers.get('location');
    if (headLocation) {
      const finalUrl = absolutizeUrl(normalized, headLocation);
      return { finalUrl, html: '' };
    }
  } catch {
    // ignore and continue
  }

  let currentUrl = normalized;

  // 手动跟随重定向，兼容 xhslink 短链
  try {
    for (let hop = 0; hop < 6; hop += 1) {
      const response = await fetch(currentUrl, {
        headers: XHS_HEADERS,
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
      const embeddedUrl = extractXhsUrlFromText(html);
      return {
        // 优先保留响应 URL（通常包含 xsec_token 等查询参数），否则再回退到页面内提取链接
        finalUrl: response.url || embeddedUrl || currentUrl,
        html,
      };
    }
  } catch {
    // 继续 follow 模式兜底
  }

  try {
    const response = await fetch(normalized, {
      headers: XHS_HEADERS,
      redirect: 'follow',
    });

    return {
      finalUrl: response.url || normalized,
      html: await response.text(),
    };
  } catch {
    return {
      finalUrl: normalized,
      html: '',
    };
  }
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

function extractXhsUrlFromText(text: string): string {
  if (!text) {
    return '';
  }

  const redirectPattern = /(?:window\.location(?:\.href|\.replace)?\s*=\s*|location\.replace\()\s*['"]([^'"]+)['"]/i;
  const redirectMatch = text.match(redirectPattern);
  if (redirectMatch?.[1]) {
    const redirectUrl = decodeEmbeddedUrl(redirectMatch[1]);
    if (isXhsNoteUrl(redirectUrl)) {
      return redirectUrl;
    }
  }

  const plainMatch = text.match(
    /https?:\/\/(?:www\.)?xiaohongshu\.com\/(?:explore|discovery\/item|item|sns\/note)\/[a-zA-Z0-9]+[^\s"'<>]*/i
  );
  if (plainMatch?.[0]) {
    return decodeEmbeddedUrl(plainMatch[0]);
  }

  const escapedMatch = text.match(
    /https?:\\\/\\\/(?:www\.)?xiaohongshu\.com\\\/(?:explore|discovery\\\/item|item|sns\\\/note)\\\/[a-zA-Z0-9]+[^"'<>]*/i
  );
  if (escapedMatch?.[0]) {
    return decodeEmbeddedUrl(escapedMatch[0].replace(/\\\//g, '/'));
  }

  const encodedMatch = text.match(
    /https%3A%2F%2F(?:www\.)?xiaohongshu\.com%2F(?:explore|discovery%2Fitem|item|sns%2Fnote)%2F[a-zA-Z0-9]+[^"'<>]*/i
  );
  if (encodedMatch?.[0]) {
    try {
      return decodeEmbeddedUrl(decodeURIComponent(encodedMatch[0]));
    } catch {
      return '';
    }
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

function isXhsNoteUrl(url: string): boolean {
  return /https?:\/\/(?:www\.)?xiaohongshu\.com\/(?:explore|discovery\/item|item|sns\/note)\//i.test(url);
}

function buildCandidateUrls(input: { finalUrl: string; embeddedUrl: string; noteId: string }): string[] {
  const urls = new Set<string>();

  if (input.finalUrl) {
    urls.add(input.finalUrl);
  }
  if (input.embeddedUrl) {
    urls.add(input.embeddedUrl);
  }

  urls.add(`https://www.xiaohongshu.com/explore/${input.noteId}`);
  urls.add(`https://www.xiaohongshu.com/discovery/item/${input.noteId}`);
  urls.add(`https://www.xiaohongshu.com/item/${input.noteId}`);

  return Array.from(urls);
}

function extractExtraUrlsFromState(initialState: AnyObject, noteId: string): string[] {
  const urls = new Set<string>();

  const routeOriginalUrl = asString(get(initialState, ['noteData', 'routeQuery', 'originalUrl']));
  if (routeOriginalUrl) {
    const decoded = decodeEmbeddedUrl(routeOriginalUrl);
    if (isXhsNoteUrl(decoded)) {
      urls.add(decoded);
    }
  }

  const shareLink = asString(get(initialState, ['noteData', 'collectionData', 'shareInfo', 'shareLink']));
  if (shareLink) {
    const decoded = decodeEmbeddedUrl(shareLink);
    if (isXhsNoteUrl(decoded)) {
      urls.add(decoded);
    }
  }

  const serializedState = JSON.stringify(initialState);
  const extracted = extractXhsUrlFromText(serializedState);
  if (extracted) {
    urls.add(extracted);
  }

  // 兜底再补齐基础路径
  urls.add(`https://www.xiaohongshu.com/explore/${noteId}`);
  urls.add(`https://www.xiaohongshu.com/discovery/item/${noteId}`);
  urls.add(`https://www.xiaohongshu.com/item/${noteId}`);

  return Array.from(urls);
}

function isAppOnlyPage(html: string): boolean {
  return html.includes('当前内容仅支持在小红书 APP 内查看') || html.includes('打开 APP 查看');
}

async function fetchNoteHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: XHS_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`小红书页面请求失败: HTTP ${response.status}`);
  }

  return response.text();
}

function extractInitialState(html: string): AnyObject {
  const markers = [
    'window.__INITIAL_STATE__=',
    'window.__INITIAL_STATE__ = ',
    'window.__INITIAL_SSR_STATE__=',
    'window.__INITIAL_SSR_STATE__ = ',
  ];

  let jsonText: string | null = null;
  for (const marker of markers) {
    jsonText = extractJsonByMarker(html, marker);
    if (jsonText) {
      break;
    }
  }

  if (!jsonText) {
    throw new Error('页面中未找到 __INITIAL_STATE__');
  }

  try {
    return JSON.parse(sanitizeJsonLikeString(jsonText)) as AnyObject;
  } catch {
    throw new Error('__INITIAL_STATE__ 解析失败');
  }
}

function sanitizeJsonLikeString(text: string): string {
  return text
    .replace(/:\s*undefined(?=[,}])/g, ':null')
    .replace(/,\s*undefined(?=[,\]])/g, ',null');
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

function findNoteData(initialState: AnyObject, noteId: string): AnyObject | null {
  const directCandidates: unknown[] = [
    get(initialState, ['note', 'noteDetailMap', noteId, 'note', 'noteCard']),
    get(initialState, ['note', 'noteDetailMap', noteId, 'note']),
    get(initialState, ['note', 'noteDetailMap', noteId]),
    get(initialState, ['note', 'noteData', 'note', 'noteCard']),
    get(initialState, ['note', 'noteData', 'note']),
    get(initialState, ['noteData', 'noteData', 'noteCard']),
    get(initialState, ['noteData', 'noteData']),
    get(initialState, ['noteData', 'data', 'noteCard']),
    get(initialState, ['noteData', 'data', 'note']),
    get(initialState, ['noteData', 'normalNotePreloadData', 'noteCard']),
    get(initialState, ['noteData', 'normalNotePreloadData', 'note']),
    get(initialState, ['noteData', 'normalNotePreloadData']),
    get(initialState, ['resource', 'note']),
    get(initialState, ['note']),
  ];

  let bestCandidate: AnyObject | null = null;
  let bestScore = 0;

  for (const candidate of directCandidates) {
    const score = scoreCandidate(candidate, noteId);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate as AnyObject;
    }
  }

  const visited = new Set<unknown>();
  const queue: unknown[] = [initialState];
  let level = 0;

  while (queue.length > 0 && level < 8) {
    const size = queue.length;
    for (let i = 0; i < size; i += 1) {
      const current = queue.shift();
      if (!current || typeof current !== 'object' || visited.has(current)) {
        continue;
      }
      visited.add(current);

      const score = scoreCandidate(current, noteId);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = current as AnyObject;
      }

      for (const value of Object.values(current as AnyObject)) {
        if (value && typeof value === 'object') {
          queue.push(value);
        }
      }
    }
    level += 1;
  }

  return bestScore >= 7 ? bestCandidate : null;
}

function get(obj: unknown, keys: Array<string>): unknown {
  let current: unknown = obj;
  for (const key of keys) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return null;
    }
    current = (current as AnyObject)[key];
  }
  return current;
}

function scoreCandidate(value: unknown, noteId: string): number {
  if (!value || typeof value !== 'object') {
    return 0;
  }

  const data = value as AnyObject;
  const noteCard = asObject(data.noteCard) ?? asObject(data.note_card);
  const payload = noteCard ?? data;

  let score = 0;
  const id = asString(payload.noteId) || asString(payload.note_id) || asString(payload.id);

  if (id && id.toLowerCase() === noteId.toLowerCase()) {
    score += 6;
  }

  if (hasMediaLikeData(payload)) {
    score += 4;
  }

  if (payload.title || payload.desc) {
    score += 1;
  }

  if (payload.user || payload.author) {
    score += 1;
  }

  if (noteCard) {
    score += 2;
  }

  return score;
}

function hasMediaLikeData(data: AnyObject): boolean {
  if (asArray(data.imageList)?.length || asArray(data.images)?.length) {
    return true;
  }

  const video = asObject(data.video);
  if (!video) {
    return false;
  }

  const media = asObject(video.media);
  const stream = asObject(media?.stream);

  return Boolean(
    media?.url ||
      stream?.url ||
      stream?.masterUrl ||
      asArray(stream?.h264)?.length ||
      asArray(stream?.h265)?.length ||
      asArray(stream?.av1)?.length
  );
}

function transformToParseResult(noteData: AnyObject): ParseResult {
  const payload = normalizeNotePayload(noteData);
  const title = asString(payload.title) || asString(payload.desc) || '小红书笔记';
  const user = asObject(payload.user) ?? asObject(payload.author) ?? asObject(noteData.user) ?? {};
  const authorName = asString(user.nickname) || asString(user.name) || '未知作者';
  const authorAvatar =
    sanitizeMediaUrl(asString(user.avatar) || asString(user.image) || asString(user.avatarUrl)) || '';

  const payloadImages = collectImages(payload);
  const images = payloadImages.length > 0 ? payloadImages : collectImages(noteData);
  const videoUrl = collectVideoUrl(payload) || collectVideoUrl(noteData);
  const cover = collectCover(payload, images) || collectCover(noteData, images);

  if (videoUrl) {
    const result: VideoResult = {
      type: 'video',
      title,
      cover: cover || '',
      videoUrl,
      author: {
        name: authorName,
        avatar: authorAvatar,
      },
    };
    return result;
  }

  if (images.length > 0) {
    const result: ImagesResult = {
      type: 'images',
      title,
      cover: cover || images[0] || '',
      images,
      author: {
        name: authorName,
        avatar: authorAvatar,
      },
    };
    return result;
  }

  const payloadKeys = Object.keys(payload).slice(0, 20).join(',');
  throw new Error(`未提取到视频或图片资源，候选字段: ${payloadKeys || 'none'}`);
}

function normalizeNotePayload(noteData: AnyObject): AnyObject {
  const noteCard = asObject(noteData.noteCard) ?? asObject(noteData.note_card);
  if (noteCard) {
    return noteCard;
  }
  return noteData;
}

function collectImages(noteData: AnyObject): string[] {
  const rawList = asArray(noteData.imageList) ?? asArray(noteData.images) ?? [];
  const unique = new Set<string>();

  for (const image of rawList) {
    const imageObj = asObject(image);
    if (!imageObj) {
      continue;
    }

    const selected =
      sanitizeMediaUrl(
        asString(imageObj.urlDefault) ||
          asString(imageObj.url) ||
          asString(imageObj.urlPre) ||
          pickBestInfoListUrl(asArray(imageObj.infoList)) ||
          pickBestInfoListUrl(asArray(imageObj.urlInfoList))
      ) || '';

    if (selected) {
      unique.add(selected);
    }
  }

  return Array.from(unique);
}

function pickBestInfoListUrl(infoList: unknown[] | null): string {
  if (!infoList || infoList.length === 0) {
    return '';
  }

  const sorted = infoList
    .map((item) => asObject(item))
    .filter((item): item is AnyObject => Boolean(item))
    .sort((a, b) => asNumber(b.width) * asNumber(b.height) - asNumber(a.width) * asNumber(a.height));

  return asString(sorted[0]?.url) || asString(sorted[0]?.masterUrl);
}

function collectVideoUrl(noteData: AnyObject): string {
  const video = asObject(noteData.video) ?? {};
  const media = asObject(video.media) ?? {};
  const stream = asObject(media.stream) ?? {};
  const h264 = asObject(media.h264) ?? {};
  const h265 = asObject(media.h265) ?? {};
  const firstH264 = asObject(asArray(stream.h264)?.[0]) ?? {};
  const firstH265 = asObject(asArray(stream.h265)?.[0]) ?? {};
  const firstAv1 = asObject(asArray(stream.av1)?.[0]) ?? {};

  const candidates = [
    asString(stream.masterUrl),
    asString(stream.url),
    asString(firstAv1.masterUrl),
    asString(firstAv1.url),
    asString(firstH265.masterUrl),
    asString(firstH265.url),
    asString(firstH264.masterUrl),
    asString(firstH264.url),
    asString(h265.masterUrl),
    asString(h265.url),
    asString(h264.masterUrl),
    asString(h264.url),
    asString(media.url),
    asString(video.url),
  ];

  for (const candidate of candidates) {
    const sanitized = sanitizeMediaUrl(candidate);
    if (sanitized) {
      return sanitized;
    }
  }

  return '';
}

function collectCover(noteData: AnyObject, images: string[]): string {
  const cover = asObject(noteData.cover) ?? {};
  const firstImage = asObject(asArray(noteData.imageList)?.[0]) ?? {};
  const coverCandidate =
    sanitizeMediaUrl(
      asString(cover.urlDefault) ||
        asString(cover.url) ||
        asString(firstImage.urlDefault) ||
        asString(firstImage.url) ||
        asString(noteData.image)
    ) || '';

  if (coverCandidate) {
    return coverCandidate;
  }

  return images[0] || '';
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

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
