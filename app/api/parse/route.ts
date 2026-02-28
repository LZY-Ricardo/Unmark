import { NextRequest, NextResponse } from 'next/server';
import { parseXiaohongshuNoCookie } from '@/lib/xiaohongshu/parser';

/**
 * 智能路由 - 自动选择最佳解析方式
 *
 * 抖音：使用无Cookie模式（无需Docker，快速、安全）
 * 其他平台：使用Docker后端API
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: '请提供链接' },
        { status: 400 }
      );
    }

    // 检测平台
    const platform = detectPlatform(url);

    let result;
    let mode: string;

    switch (platform) {
      case 'douyin':
        // 抖音使用无Cookie模式
        result = await parseDouyinNoCookie(url);
        mode = 'no-cookie';
        break;

      case 'xiaohongshu':
        // 小红书优先后端解析（用户无感），无Cookie仅兜底
        try {
          result = await parseWithBackend(url, platform);
          mode = 'backend';
        } catch (backendError: any) {
          try {
            result = await parseXiaohongshuNoCookie(url);
            mode = 'no-cookie';
          } catch (xhsError: any) {
            if (isXiaohongshuUnsupportedByHybridBackend(backendError)) {
              throw xhsError;
            }

            const backendMessage = backendError?.message || '后端解析失败';
            const xhsMessage = xhsError?.message || '无Cookie解析失败';
            throw new Error(`${backendMessage}; ${xhsMessage}`);
          }
        }
        break;

      case 'tiktok':
      case 'kuaishou':
      case 'bilibili':
        // 其他平台使用Docker后端
        result = await parseWithBackend(url, platform);
        mode = 'backend';
        break;

      default:
        return NextResponse.json(
          { error: `暂不支持该平台: ${url}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
      mode,
      platform,
    });
  } catch (error: any) {
    const message = error?.message || '解析失败';
    const status = getErrorStatus(message);
    console.error('解析错误:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}

function getErrorStatus(message: string): number {
  if (message.includes('请提供链接') || message.includes('暂不支持')) {
    return 400;
  }

  if (
    message.includes('无法从') ||
    message.includes('未提取到') ||
    message.includes('无效') ||
    message.includes('仅支持在小红书 APP 内查看')
  ) {
    return 422;
  }

  if (
    message.includes('后端API错误') ||
    message.includes('fetch failed') ||
    message.includes('ECONNREFUSED')
  ) {
    return 503;
  }

  return 500;
}

/**
 * 检测链接所属平台
 */
function detectPlatform(url: string): string {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('douyin.com') || lowerUrl.includes('v.douyin.com')) {
    return 'douyin';
  }
  if (lowerUrl.includes('tiktok.com') || lowerUrl.includes('vm.tiktok.com')) {
    return 'tiktok';
  }
  if (lowerUrl.includes('kuaishou.com') || lowerUrl.includes('v.kuaishou.com')) {
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

/**
 * 抖音无Cookie解析
 */
async function parseDouyinNoCookie(url: string) {
  const { extractIdFromUrl, parseDouyinNoCookie: parse, transformNoCookieResult } =
    await import('@/lib/no_cookie_parser');

  // 从分享口令中提取URL
  const urlRegex = /(https?:\/\/)?(v\.douyin\.com|douyin\.com)\/[a-zA-Z0-9\/]+/;
  const match = url.match(urlRegex);
  let cleanUrl = url;

  if (match && match[0]) {
    cleanUrl = match[0];
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = 'https://' + cleanUrl;
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

/**
 * 使用Docker后端解析（其他平台）
 */
async function parseWithBackend(url: string, platform: string) {
  const backendUrl = process.env.DOUYIN_API_URL || 'http://localhost:8080';
  const params = new URLSearchParams({
    url,
    minimal: 'false',
  });

  const response = await fetch(`${backendUrl}/api/hybrid/video_data?${params.toString()}`, {
    method: 'GET',
  });

  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch {
      // ignore
    }
    throw new Error(`后端API错误: ${response.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`);
  }

  const apiData = await response.json();

  // 转换后端API数据格式为前端格式
  return transformBackendData(apiData, platform);
}

/**
 * 转换后端API数据为前端格式
 */
function transformBackendData(apiData: any, platform: string) {
  if (platform === 'xiaohongshu') {
    return transformXiaohongshuBackendData(apiData);
  }

  const awemeDetail = apiData?.data;
  if (!awemeDetail) {
    throw new Error('API 返回数据格式不正确');
  }

  const video = awemeDetail.video;
  const author = awemeDetail.author;
  const desc = awemeDetail.desc;

  // 判断是视频还是图集
  const images = awemeDetail.images?.map((img: any) => img.url_list?.[0]) || [];
  const isImages = images.length > 0;

  if (isImages) {
    // 图集类型
    return {
      type: 'images' as const,
      title: desc || `${platform}图集`,
      cover: images[0] || '',
      author: {
        name: author?.nickname || '未知用户',
        avatar: author?.avatar_thumb?.url_list?.[0] || '',
      },
      images: images,
    };
  } else {
    // 视频类型
    const playUrl = video?.play_addr?.url_list?.[0] ||
                    video?.bit_rate?.[0]?.play_addr?.url_list?.[0] || '';

    // 将 playwm（有水印）替换为 play（无水印）
    const noWatermarkUrl = playUrl.replace('playwm', 'play');

    return {
      type: 'video' as const,
      title: desc || `${platform}视频`,
      cover: video?.cover?.url_list?.[0] || '',
      author: {
        name: author?.nickname || '未知用户',
        avatar: author?.avatar_thumb?.url_list?.[0] || '',
      },
      videoUrl: noWatermarkUrl,
    };
  }
}

function transformXiaohongshuBackendData(apiData: any) {
  const root = apiData?.data ?? apiData;
  if (!root || typeof root !== 'object') {
    throw new Error('小红书后端返回为空');
  }

  const payloadCandidates = [
    root,
    root?.data,
    root?.note,
    root?.note_info,
    root?.noteInfo,
    root?.note_card,
    root?.noteCard,
    root?.item,
    Array.isArray(root?.items) ? root.items[0] : null,
  ].filter(Boolean);

  const payload = payloadCandidates.find((item) => hasAnyMedia(item)) ?? root;
  const title =
    pickFirstString(payload, ['title', 'desc', 'note_desc', 'content']) ||
    pickFirstString(root, ['title', 'desc']) ||
    '小红书内容';

  const authorName =
    pickFirstString(payload?.author, ['nickname', 'name']) ||
    pickFirstString(payload?.user, ['nickname', 'name']) ||
    pickFirstString(root?.author, ['nickname', 'name']) ||
    '未知用户';

  const authorAvatar = sanitizeMediaUrl(
    pickFirstString(payload?.author, ['avatar', 'avatar_url', 'image']) ||
    pickFirstString(payload?.user, ['avatar', 'avatar_url', 'image']) ||
    ''
  );

  const images = extractXhsImages(payload).map(sanitizeMediaUrl).filter(Boolean);
  const videoUrl = sanitizeMediaUrl(extractXhsVideoUrl(payload));
  const cover = images[0] || sanitizeMediaUrl(extractXhsCover(payload));

  if (images.length > 0) {
    return {
      type: 'images' as const,
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
      type: 'video' as const,
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

function hasAnyMedia(obj: any): boolean {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  return extractXhsImages(obj).length > 0 || Boolean(extractXhsVideoUrl(obj));
}

function extractXhsImages(obj: any): string[] {
  const list = [
    ...(Array.isArray(obj?.images) ? obj.images : []),
    ...(Array.isArray(obj?.imageList) ? obj.imageList : []),
    ...(Array.isArray(obj?.image_list) ? obj.image_list : []),
    ...(Array.isArray(obj?.note_image_list) ? obj.note_image_list : []),
    ...(Array.isArray(obj?.photos) ? obj.photos : []),
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

    if (typeof item === 'object') {
      const fromUrlList = Array.isArray((item as any).url_list) ? (item as any).url_list[0] : '';
      const fromInfoList = Array.isArray((item as any).info_list) ? (item as any).info_list[0]?.url : '';
      const url =
        (item as any).url ||
        (item as any).urlDefault ||
        (item as any).masterUrl ||
        fromUrlList ||
        fromInfoList ||
        '';
      if (url) {
        urls.add(url);
      }
    }
  }

  return Array.from(urls);
}

function extractXhsVideoUrl(obj: any): string {
  const candidates = [
    pickFirstString(obj, ['video_url', 'videoUrl']),
    pickFirstString(obj?.video, ['url', 'masterUrl']),
    pickFirstString(obj?.video?.media, ['url']),
    pickFirstString(obj?.video?.media?.stream, ['url', 'masterUrl']),
    Array.isArray(obj?.video?.media?.stream?.h264) ? obj.video.media.stream.h264[0]?.url : '',
    Array.isArray(obj?.video?.media?.stream?.h265) ? obj.video.media.stream.h265[0]?.url : '',
    Array.isArray(obj?.video?.play_addr?.url_list) ? obj.video.play_addr.url_list[0] : '',
  ];

  return (candidates.find(Boolean) as string) || '';
}

function extractXhsCover(obj: any): string {
  return (
    pickFirstString(obj?.cover, ['url', 'urlDefault']) ||
    pickFirstString(obj, ['cover', 'image']) ||
    ''
  );
}

function pickFirstString(target: any, keys: string[]): string {
  if (!target || typeof target !== 'object') {
    return '';
  }

  for (const key of keys) {
    const value = target[key];
    if (typeof value === 'string' && value) {
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

function isXiaohongshuUnsupportedByHybridBackend(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    message.includes('后端API错误: 400') ||
    message.includes('后端API错误: 404')
  );
}
