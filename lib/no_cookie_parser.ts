/**
 * 无Cookie抖音解析器
 * 从抖音移动端HTML中提取 _ROUTER_DATA
 */

export interface NoCookieVideoResult {
  aweme_id: string;
  desc: string;
  author: {
    nickname: string;
    avatar_thumb: {
      url_list: string[];
    };
  };
  images?: Array<{
    url_list: string[];
  }>;
  video?: {
    play_addr: {
      url_list: string[];
    };
    cover: {
      url_list: string[];
    };
  };
}

/**
 * 从短链接提取video_id/note_id
 */
export async function extractIdFromUrl(shortUrl: string): Promise<string | null> {
  try {
    const response = await fetch(shortUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U) AppleWebKit/537.36',
      },
      redirect: 'follow',
    });

    const finalUrl = response.url;

    // 尝试提取ID
    if (finalUrl.includes('/video/')) {
      return finalUrl.split('/video/')[1].split('/')[0];
    }

    if (finalUrl.includes('share/video/')) {
      return finalUrl.split('share/video/')[1].split('/')[0];
    }

    if (finalUrl.includes('/share/note/')) {
      const parts = finalUrl.split('share/note/')[1].split('/')[0].split('?');
      return parts[0];
    }

    return null;
  } catch (error) {
    console.error('提取ID失败:', error);
    return null;
  }
}

/**
 * 无Cookie解析抖音内容
 */
export async function parseDouyinNoCookie(id: string): Promise<NoCookieVideoResult | null> {
  const url = `https://www.iesdouyin.com/share/video/${id}/`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        'Referer': 'https://www.douyin.com/',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // 提取 window._ROUTER_DATA
    const marker = 'window._ROUTER_DATA = ';
    const startIdx = html.indexOf(marker);

    if (startIdx === -1) {
      throw new Error('未找到 _ROUTER_DATA');
    }

    // 从标记后开始
    let jsonStart = startIdx + marker.length;

    // 找到匹配的结束位置
    let bracketCount = 0;
    let inString = false;
    let escape = false;
    let jsonEnd = jsonStart;

    for (let i = jsonStart; i < html.length; i++) {
      const char = html[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === '\\') {
        escape = true;
        continue;
      }

      if (char === '"' && !escape) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          bracketCount++;
        } else if (char === '}') {
          bracketCount--;
          if (bracketCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
    }

    // 提取JSON字符串
    const jsonStr = html.substring(jsonStart, jsonEnd);
    const data = JSON.parse(jsonStr);

    // 提取视频/图集数据
    const item = data?.loaderData?.['video_(id)/page']?.videoInfoRes?.item_list?.[0];

    if (!item) {
      throw new Error('未找到视频数据');
    }

    return item;
  } catch (error) {
    console.error('无Cookie解析失败:', error);
    return null;
  }
}

/**
 * 转换为前端格式
 */
export function transformNoCookieResult(data: NoCookieVideoResult) {
  const isImages = !!data.images && data.images.length > 0;

  if (isImages) {
    const images = (data.images ?? []).map((img) => img.url_list[0]).filter(Boolean);
    // 图集类型
    return {
      type: 'images' as const,
      title: data.desc || '抖音图集',
      author: {
        name: data.author.nickname,
        avatar: data.author.avatar_thumb.url_list[0] || '',
      },
      cover: images[0] || '',
      images,
    };
  } else {
    const playUrl = data.video?.play_addr?.url_list[0] || '';
    const noWatermarkVideoUrl = toNoWatermarkDouyinUrl(playUrl);

    // 视频类型
    return {
      type: 'video' as const,
      title: data.desc || '抖音视频',
      author: {
        name: data.author.nickname,
        avatar: data.author.avatar_thumb.url_list[0] || '',
      },
      videoUrl: noWatermarkVideoUrl,
      cover: data.video?.cover?.url_list[0] || '',
    };
  }
}

function toNoWatermarkDouyinUrl(url: string): string {
  if (!url) {
    return '';
  }

  const replaced = url.replace('/playwm/', '/play/').replace('playwm', 'play');

  try {
    const parsed = new URL(replaced);
    parsed.searchParams.delete('watermark');
    return parsed.toString();
  } catch {
    return replaced.replace(/([?&])watermark=[^&]*/i, '').replace(/[?&]$/, '');
  }
}
