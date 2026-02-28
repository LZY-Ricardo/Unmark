import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const DOUYIN_URL_REGEX = /(https?:\/\/)?(?:v\.douyin\.com|www\.douyin\.com|douyin\.com)\/[^\s]+/i;
const XHS_URL_REGEX = /(https?:\/\/)?(?:www\.)?(?:xiaohongshu\.com|xhslink\.com)\/[^\s]+/i;
const KUAISHOU_URL_REGEX =
  /(https?:\/\/)?(?:v\.kuaishou\.com|www\.kuaishou\.com|kuaishou\.com|kuaishou\.cn|live\.kuaishou\.com)\/[^\s]+/i;

/**
 * 合并 Tailwind CSS 类名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 从抖音分享口令中提取URL
 * 支持格式：
 * - 纯URL: https://v.douyin.com/xxxxx/
 * - 分享口令: 2.07 复制打开抖音，看看... https://v.douyin.com/xxxxx/ 09/14 h@O.XM qRk:/
 */
export function extractDouyinUrl(text: string): string {
  const match = text.match(DOUYIN_URL_REGEX);

  if (match && match[0]) {
    let url = trimTrailingPunctuation(match[0]);

    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    if (!url.includes('?') && !url.endsWith('/')) {
      url += '/';
    }

    return url;
  }

  return text; // 如果没有找到URL，返回原文
}

/**
 * 验证是否为有效的抖音链接
 */
export function isValidDouyinUrl(url: string): boolean {
  const douyinRegex = /(douyin\.com|v\.douyin\.com)/i;
  return douyinRegex.test(url);
}

/**
 * 从快手分享口令中提取 URL
 */
export function extractKuaishouUrl(text: string): string {
  const match = text.match(KUAISHOU_URL_REGEX);

  if (match && match[0]) {
    let url = trimTrailingPunctuation(match[0]);

    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    return url;
  }

  return text;
}

/**
 * 从文本中提取支持的平台链接（抖音/小红书/快手）
 */
export function extractSupportedUrl(text: string): string {
  const douyinUrl = extractDouyinUrl(text);
  if (douyinUrl !== text) {
    return douyinUrl;
  }

  const xhsMatched = text.match(XHS_URL_REGEX);
  if (xhsMatched?.[0]) {
    let url = trimTrailingPunctuation(xhsMatched[0]);
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }
    return url;
  }

  const kuaishouUrl = extractKuaishouUrl(text);
  if (kuaishouUrl !== text) {
    return kuaishouUrl;
  }

  return text;
}

/**
 * 校验是否为当前支持的平台链接
 */
export function isValidSupportedUrl(url: string): boolean {
  return DOUYIN_URL_REGEX.test(url) || XHS_URL_REGEX.test(url) || KUAISHOU_URL_REGEX.test(url);
}

function trimTrailingPunctuation(url: string): string {
  return url.replace(/[)\]}>，。,！!？?;；]+$/g, '');
}

/**
 * 格式化错误消息
 */
export function formatErrorMessage(error: any): string {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.message) {
    return error.message;
  }
  return '未知错误';
}

/**
 * 下载文件（支持跨域图片）
 */
export async function downloadFile(url: string, filename: string) {
  try {
    // 使用 fetch 获取图片数据
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      throw new Error('下载失败');
    }

    // 获取 blob 数据
    const blob = await response.blob();

    // 创建 object URL
    const blobUrl = window.URL.createObjectURL(blob);

    // 创建下载链接
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    // 清理
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('下载失败:', error);

    // 降级方案：直接在新标签页打开图片
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * 下载图片（带编号和标题）
 */
export async function downloadImage(url: string, title: string, index: number) {
  const extension = inferImageExtension(url);

  // 清理文件名中的非法字符
  const cleanTitle = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);

  // 生成文件名
  const filename = `${cleanTitle}_${index + 1}.${extension}`;

  await downloadFile(url, filename);
}

function inferImageExtension(url: string): string {
  const normalized = url.toLowerCase();

  // 常见路径扩展名：.../image.jpg 或 .../image.webp?x=1
  const directExt = normalized.match(/\.([a-z0-9]+)(?:$|[?#])/i)?.[1];
  const validDirect = normalizeImageExtension(directExt || '');
  if (validDirect) {
    return validDirect;
  }

  // 小红书常见后缀：...!nd_dft_wgth_jpg_3
  const xhsStyleExt = normalized.match(/[_!](jpg|jpeg|png|webp|gif|bmp|avif|heic)(?:[_!]|$)/i)?.[1];
  const validXhsStyle = normalizeImageExtension(xhsStyleExt || '');
  if (validXhsStyle) {
    return validXhsStyle;
  }

  return 'jpg';
}

function normalizeImageExtension(ext: string): string {
  if (!ext) {
    return '';
  }

  const cleaned = ext.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const allowlist = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'heic']);
  if (!allowlist.has(cleaned)) {
    return '';
  }

  return cleaned === 'jpeg' ? 'jpg' : cleaned;
}
