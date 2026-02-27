import { NextRequest, NextResponse } from 'next/server';

const DOUYIN_API_URL = process.env.DOUYIN_API_URL || 'http://douyin-api:8080';
const API_TIMEOUT = 30000; // 30 秒

// 模拟数据模式（用于前端测试，无需 Docker）
const MOCK_MODE = process.env.MOCK_MODE === 'true';

// 模拟视频数据
const mockVideoData = {
  type: 'video',
  title: '【测试】这是一个模拟的视频标题',
  cover: 'https://picsum.photos/seed/video/800/450',
  author: {
    name: '测试用户',
    avatar: 'https://picsum.photos/seed/avatar/100/100',
  },
  video_url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
  description: '这是一个模拟的视频描述，用于测试前端界面展示效果。',
};

// 模拟图集数据
const mockImagesData = {
  type: 'images',
  title: '【测试】这是一个模拟的图集标题',
  author: {
    name: '测试用户',
    avatar: 'https://picsum.photos/seed/avatar/100/100',
  },
  images: Array.from({ length: 6 }, (_, i) =>
    `https://picsum.photos/seed/image${i}/800/800`
  ),
  description: '这是一个模拟的图集描述，用于测试前端界面展示效果。',
};

/**
 * 将开源 API 响应转换为我们的格式
 */
function transformApiResponse(apiData: any): any {
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
      type: 'images',
      title: desc || '抖音图集',
      author: {
        name: author?.nickname || '未知用户',
        avatar: author?.avatar_thumb?.url_list?.[0] || '',
      },
      images: images,
      description: desc || '',
    };
  } else {
    // 视频类型
    const playUrl = video?.play_addr?.url_list?.[0] ||
                    video?.bit_rate?.[0]?.play_addr?.url_list?.[0] || '';

    // 将 playwm（有水印）替换为 play（无水印）
    const noWatermarkUrl = playUrl.replace('playwm', 'play');

    return {
      type: 'video',
      title: desc || '抖音视频',
      cover: video?.cover?.url_list?.[0] ||
              video?.origin_cover?.url_list?.[0] ||
              awemeDetail?.video?.cover?.url_list?.[0] || '',
      author: {
        name: author?.nickname || '未知用户',
        avatar: author?.avatar_thumb?.url_list?.[0] || '',
      },
      video_url: noWatermarkUrl,
      description: desc || '',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    // 1. 验证 URL 格式
    if (!url || typeof url !== 'string') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: '请输入有效的链接',
        }
      }, { status: 400 });
    }

    // 2. 从分享口令中提取URL（如果用户粘贴了完整分享口令）
    const urlRegex = /(https?:\/\/)?(v\.douyin\.com|douyin\.com)\/[a-zA-Z0-9\/]+/;
    const match = url.match(urlRegex);
    let cleanUrl = url;

    if (match && match[0]) {
      cleanUrl = match[0];
      // 确保URL以http开头
      if (!cleanUrl.startsWith('http')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      // 确保URL以/结尾
      if (!cleanUrl.endsWith('/')) {
        cleanUrl += '/';
      }
    }

    // 3. 验证是否为抖音链接
    const douyinRegex = /(douyin\.com|v\.douyin\.com)/i;
    if (!douyinRegex.test(cleanUrl)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_DOUYIN_URL',
          message: '请输入抖音分享链接',
        }
      }, { status: 400 });
    }

    // 4. 模拟模式：返回假数据
    if (MOCK_MODE) {
      const isVideo = !cleanUrl.includes('note');
      await new Promise(resolve => setTimeout(resolve, 1000));

      return NextResponse.json({
        success: true,
        data: isVideo ? mockVideoData : mockImagesData,
        message: '解析成功（模拟数据）'
      });
    }

    // 5. 真实模式：使用混合解析端点
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const apiUrl = `${DOUYIN_API_URL}/api/hybrid/video_data?url=${encodeURIComponent(cleanUrl)}&minimal=false`;

      const response = await fetch(apiUrl, {
        headers: {
          'Referer': 'https://www.douyin.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 返回错误 ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // 检查 API 响应
      if (!data || data.code !== 200) {
        throw new Error(`API 返回错误: ${JSON.stringify(data)}`);
      }

      // 转换为我们的格式
      const transformedData = transformApiResponse(data);

      return NextResponse.json({
        success: true,
        data: transformedData,
        message: '解析成功'
      });

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      throw fetchError;
    }

  } catch (error: any) {
    console.error('Parse error:', error);

    // 错误处理
    if (error.name === 'AbortError' || error.message?.includes('abort')) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'TIMEOUT',
          message: '解析超时，请稍后重试'
        }
      }, { status: 504 });
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'PARSE_FAILED',
        message: '解析失败，请检查链接是否有效',
        details: error.message
      }
    }, { status: 500 });
  }
}
