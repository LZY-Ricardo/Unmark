/**
 * 小红书登录占位模块
 * 当前项目已默认启用无Cookie解析，此文件仅保留兼容导出。
 */

const UNSUPPORTED_MESSAGE = '当前版本不支持小红书扫码登录，请使用无Cookie解析接口';

export async function saveCookies(): Promise<void> {
  throw new Error(UNSUPPORTED_MESSAGE);
}

export async function loadCookies(): Promise<null> {
  return null;
}

export async function checkCookiesValid(): Promise<boolean> {
  return false;
}

export async function generateQRCode(): Promise<string> {
  throw new Error(UNSUPPORTED_MESSAGE);
}

export async function checkLoginStatus(): Promise<{ success: boolean; cookies?: never[] }> {
  return { success: false };
}

export async function refreshLogin(): Promise<boolean> {
  return false;
}

export async function requestWithCookies(): Promise<never> {
  throw new Error(UNSUPPORTED_MESSAGE);
}
