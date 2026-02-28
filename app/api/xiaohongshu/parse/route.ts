/**
 * 小红书解析 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseXiaohongshuNoCookie } from '@/lib/xiaohongshu/parser';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({
        success: false,
        error: '请提供小红书链接',
      });
    }

    // 无Cookie解析
    const data = await parseXiaohongshuNoCookie(url);

    return NextResponse.json({
      success: true,
      data,
      platform: 'xiaohongshu',
    });
  } catch (error: any) {
    console.error('[XHS Parse API] Error:', error);

    return NextResponse.json({
      success: false,
      error: error.message || '解析失败',
    });
  }
}
