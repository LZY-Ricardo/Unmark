import { NextRequest, NextResponse } from 'next/server';
import { extractIdFromUrl, parseDouyinNoCookie, transformNoCookieResult } from '@/lib/no_cookie_parser';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: '请提供抖音链接' },
        { status: 400 }
      );
    }

    // 提取ID
    const id = await extractIdFromUrl(url);

    if (!id) {
      return NextResponse.json(
        { error: '无法从链接中提取ID' },
        { status: 400 }
      );
    }

    // 无Cookie解析
    const data = await parseDouyinNoCookie(id);

    if (!data) {
      return NextResponse.json(
        { error: '解析失败，请检查链接是否有效' },
        { status: 500 }
      );
    }

    // 转换格式
    const result = transformNoCookieResult(data);

    return NextResponse.json({
      success: true,
      data: result,
      mode: 'no-cookie',
    });
  } catch (error) {
    console.error('解析错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '解析失败' },
      { status: 500 }
    );
  }
}
