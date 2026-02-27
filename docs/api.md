# API 接口文档 - Unmark 去水印解析网站

**项目名称**: Unmark
**文档版本**: v1.0
**创建日期**: 2026-02-27
**最后更新**: 2026-02-27

---

## 1. 接口概述

### 1.1 基础信息
- **Base URL**: `http://localhost:3000/api`（开发环境）
- **协议**: HTTP/HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8

### 1.2 通用规范

#### 请求头
```http
Content-Type: application/json
Accept: application/json
```

#### 响应格式
所有接口统一返回格式：

**成功响应**:
```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": "详细错误信息（可选）"
  }
}
```

---

## 2. 接口列表

### 2.1 解析抖音链接

#### 基本信息
- **接口路径**: `/api/parse`
- **请求方法**: `POST`
- **接口描述**: 解析抖音分享链接，获取无水印资源

#### 请求参数

**Headers**:
```http
Content-Type: application/json
```

**Body**:
```json
{
  "url": "https://v.douyin.com/xxxxx/"
}
```

| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| url | string | 是 | 抖音分享链接 | `https://v.douyin.com/xxxxx/` |

#### 响应数据

**视频类型成功响应**:
```json
{
  "success": true,
  "data": {
    "type": "video",
    "title": "视频标题",
    "cover": "https://example.com/cover.jpg",
    "videoUrl": "https://example.com/video.mp4",
    "author": {
      "name": "作者昵称",
      "avatar": "https://example.com/avatar.jpg"
    }
  }
}
```

**图集类型成功响应**:
```json
{
  "success": true,
  "data": {
    "type": "images",
    "title": "图集标题",
    "cover": "https://example.com/cover.jpg",
    "images": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg",
      "https://example.com/image3.jpg"
    ],
    "author": {
      "name": "作者昵称",
      "avatar": "https://example.com/avatar.jpg"
    }
  }
}
```

**错误响应示例**:

无效链接:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_URL",
    "message": "请输入有效的抖音链接",
    "details": "链接格式不正确或不是抖音链接"
  }
}
```

解析失败:
```json
{
  "success": false,
  "error": {
    "code": "PARSE_FAILED",
    "message": "解析失败，请检查链接是否有效",
    "details": "视频可能已被删除或设为私密"
  }
}
```

超时:
```json
{
  "success": false,
  "error": {
    "code": "TIMEOUT",
    "message": "解析超时，请稍后重试",
    "details": "服务器响应时间过长"
  }
}
```

#### 错误码说明

| 错误码 | 说明 | HTTP 状态码 |
|--------|------|-------------|
| INVALID_URL | 无效的链接格式 | 400 |
| NOT_DOUYIN_URL | 非抖音链接 | 400 |
| PARSE_FAILED | 解析失败 | 500 |
| TIMEOUT | 请求超时 | 504 |
| RATE_LIMIT_EXCEEDED | 超出频率限制 | 429 |
| INTERNAL_ERROR | 服务器内部错误 | 500 |

#### 请求示例

**cURL**:
```bash
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -d '{"url":"https://v.douyin.com/xxxxx/"}'
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('http://localhost:3000/api/parse', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://v.douyin.com/xxxxx/'
  })
});

const result = await response.json();
console.log(result);
```

**Axios**:
```javascript
import axios from 'axios';

const response = await axios.post('http://localhost:3000/api/parse', {
  url: 'https://v.douyin.com/xxxxx/'
});

console.log(response.data);
```

---

## 3. TypeScript 类型定义

### 3.1 请求类型

```typescript
// 解析请求
interface ParseRequest {
  url: string;
}
```

### 3.2 响应类型

```typescript
// 通用成功响应
interface ApiResponse<T> {
  success: true;
  data: T;
  message: string;
}

// 通用错误响应
interface ApiError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: string;
  };
}

// 视频结果
interface VideoResult {
  type: 'video';
  title: string;
  cover: string;
  videoUrl: string;
  author: {
    name: string;
    avatar: string;
  };
}

// 图集结果
interface ImagesResult {
  type: 'images';
  title: string;
  cover: string;
  images: string[];
  author: {
    name: string;
    avatar: string;
  };
}

// 解析结果（联合类型）
type ParseResult = VideoResult | ImagesResult;

// 错误码枚举
enum ErrorCode {
  INVALID_URL = 'INVALID_URL',
  NOT_DOUYIN_URL = 'NOT_DOUYIN_URL',
  PARSE_FAILED = 'PARSE_FAILED',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}
```

---

## 4. 后端实现细节

### 4.1 API Route 实现

```typescript
// app/api/parse/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const DOUYIN_API_URL = process.env.DOUYIN_API_URL || 'http://douyin-api:8080';

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

    // 2. 验证是否为抖音链接
    const douyinRegex = /(douyin\.com|v\.douyin\.com)/i;
    if (!douyinRegex.test(url)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_DOUYIN_URL',
          message: '请输入抖音分享链接',
        }
      }, { status: 400 });
    }

    // 3. 转发到开源 API
    const response = await axios.post(
      `${DOUYIN_API_URL}/api/parse`,
      { url },
      {
        headers: {
          'Referer': 'https://www.douyin.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000 // 30 秒超时
      }
    );

    // 4. 返回解析结果
    return NextResponse.json({
      success: true,
      data: response.data.data,
      message: '解析成功'
    });

  } catch (error: any) {
    // 错误处理
    if (error.code === 'ECONNABORTED') {
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
```

### 4.2 环境变量配置

```env
# .env.local
DOUYIN_API_URL=http://douyin-api:8080
API_TIMEOUT=30000
```

---

## 5. 与开源 API 对接说明

### 5.1 开源 API 信息
- **项目**: Evil0ctal/Douyin_TikTok_Download_API
- **Docker 镜像**: `evil0ctal/douyin_tiktok_download_api:latest`
- **默认端口**: 8080
- **文档**: https://github.com/Evil0ctal/Douyin_TikTok_Download_API

### 5.2 对接流程

```
用户请求
    ↓
Next.js API Route (/api/parse)
    ↓
验证 + 处理
    ↓
转发到 Docker 内部开源 API
    ↓
http://douyin-api:8080/api/parse
    ↓
返回解析结果
    ↓
Next.js 格式化返回
    ↓
前端展示
```

### 5.3 关键处理

1. **CORS 处理**: Next.js 自动处理，无需额外配置
2. **防盗链**: 添加 `Referer` 头伪装请求来源
3. **超时控制**: 30 秒超时限制
4. **错误转换**: 将开源 API 错误转换为统一格式

---

## 6. 测试用例

### 6.1 正常流程测试

| 用例编号 | 测试场景 | 输入 | 预期输出 |
|----------|----------|------|----------|
| TC001 | 解析视频链接 | 有效抖音视频链接 | 返回视频无水印链接 |
| TC002 | 解析图集链接 | 有效抖音图集链接 | 返回图片数组 |
| TC003 | 解析短链接 | 抖音短链接 | 正确解析并返回 |

### 6.2 异常流程测试

| 用例编号 | 测试场景 | 输入 | 预期输出 |
|----------|----------|------|----------|
| TC101 | 空链接 | `""` | 返回 INVALID_URL |
| TC102 | 非抖音链接 | `https://www.baidu.com` | 返回 NOT_DOUYIN_URL |
| TC103 | 无效链接 | `https://v.douyin.com/invalid` | 返回 PARSE_FAILED |
| TC104 | 已删除视频 | 已删除的视频链接 | 返回 PARSE_FAILED |

---

## 7. 性能指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 响应时间 | < 5 秒 | 95% 请求 |
| 超时时间 | 30 秒 | 超过则返回超时错误 |
| 并发处理 | 50 QPS | 每秒查询数 |
| 成功率 | > 95% | 解析成功比例 |

---

## 8. 安全考虑

### 8.1 限流策略
```typescript
// 简单限流示例（生产环境建议使用 Redis）
const rateLimit = new Map();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = rateLimit.get(ip) || [];
  const recentRequests = requests.filter((t: number) => now - t < 60000);

  if (recentRequests.length >= 30) {
    return false; // 每分钟最多 30 次
  }

  recentRequests.push(now);
  rateLimit.set(ip, recentRequests);
  return true;
}
```

### 8.2 输入验证
- URL 格式验证
- 防止恶意字符注入
- 限制请求体大小

### 8.3 日志记录
```typescript
// 记录解析请求
console.log({
  timestamp: new Date().toISOString(),
  ip: request.headers.get('x-forwarded-for'),
  url: url,
  success: true/false
});
```

---

## 9. 变更记录

| 版本 | 日期 | 变更内容 | 变更人 |
|------|------|----------|--------|
| v1.0 | 2026-02-27 | 初始版本 | AI Assistant |

---

**文档维护者**: AI Assistant
**审核者**: 待指定
**批准者**: 待指定
