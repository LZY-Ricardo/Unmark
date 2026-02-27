import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  // 匹配抖音URL的正则表达式
  const urlRegex = /(https?:\/\/)?(v\.douyin\.com|douyin\.com)\/[a-zA-Z0-9\/]+/;
  const match = text.match(urlRegex);

  if (match && match[0]) {
    let url = match[0];
    // 确保URL以http开头
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    // 确保URL以/结尾（抖音短链接标准格式）
    if (!url.endsWith('/')) {
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
 * 下载文件
 */
export function downloadFile(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
