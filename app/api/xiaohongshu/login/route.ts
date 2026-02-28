/**
 * 小红书登录 API
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * 生成登录二维码
 */
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    const currentAction = typeof action === 'string' ? action : 'unknown';

    return NextResponse.json({
      success: false,
      action: currentAction,
      error: '当前版本已切换为无Cookie解析，不再提供登录能力',
    }, { status: 410 });
  } catch (error: any) {
    console.error('[XHS Login API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '登录失败',
    });
  }
}
