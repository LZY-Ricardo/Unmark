/**
 * 应用配置常量
 */

export const APP_CONFIG = {
  name: 'Unmark',
  title: '抖音去水印',
  description: '输入抖音链接，一键解析下载无水印视频和图集',
  version: '1.0.0',
} as const;

/**
 * API 配置
 */
export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
  timeout: 30000, // 30 秒
  maxRetries: 3,
} as const;

/**
 * 抖音链接正则
 */
export const DOUYIN_PATTERNS = {
  short: /v\.douyin\.com\/[a-zA-Z0-9]+/i,
  video: /douyin\.com\/video\/\d+/i,
  note: /douyin\.com\/note\/\d+/i,
  share: /douyin\.com\/.*\/share\/video\/\d+/i,
} as const;

/**
 * UI 配置
 */
export const UI_CONFIG = {
  maxImagesPerRow: 3,
  mobileImagesPerRow: 2,
  imageQuality: 90,
} as const;
