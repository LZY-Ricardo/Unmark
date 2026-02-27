import { NextRequest, NextResponse } from 'next/server';

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

      case 'tiktok':
      case 'kuaishou':
      case 'xiaohongshu':
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
    console.error('解析错误:', error);
    return NextResponse.json(
      { error: error.message || '解析失败' },
      { status: 500 }
    );
  }
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

  const response = await fetch(`${backendUrl}/api/hybrid/video_data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: url,
      minimal: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`后端API错误: ${response.status}`);
  }

  const apiData = await response.json();

  // 转换后端API数据格式为前端格式
  return transformBackendData(apiData, platform);
}

/**
 * 转换后端API数据为前端格式
 */
function transformBackendData(apiData: any, platform: string) {
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
