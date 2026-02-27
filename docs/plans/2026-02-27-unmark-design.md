# 去水印解析网站 - 技术设计方案

**项目名称**: Unmark - 轻量级去水印解析网站
**设计日期**: 2026-02-27
**版本**: v1.0

---

## 1. 项目概述

开发一个支持多端适配（PC + 移动端响应式）的去水印与视频/图集解析下载网站。一期聚焦抖音平台，后续扩展其他平台。

### 1.1 核心目标
- 一期：支持抖音平台视频/图集解析下载
- 二期：用户登录与付费去限制功能

### 1.2 设计参考
基于 [鱼皮 AI 导航](https://ai.codefather.cn/painting) 的 UI 设计风格

---

## 2. 整体架构

### 2.1 架构方案
**双容器 Docker Compose 架构**

#### 容器 1 - Next.js 全栈应用
**技术栈**: Next.js 14+ (App Router) + Tailwind CSS + TypeScript

**职责**:
- **前端部分**: 用户界面、输入表单、结果展示
- **后端部分**: Next.js API Routes 实现轻量级代理层

#### 容器 2 - 开源解析引擎
**技术选型**: `Evil0ctal/Douyin_TikTok_Download_API`

**职责**: 提供核心解析能力，仅 Next.js API Routes 可通过 Docker 内部网络访问

---

## 3. 前端设计

### 3.1 UI 设计系统（基于参考网站）

#### 配色方案
```css
--primary: #0F172A        /* 深蓝黑色 - 主色调 */
--accent: #1777FF         /* 亮蓝色 - 品牌色 */
--background: #FFFFFF     /* 纯白 - 背景色 */
--text-primary: #1F1F1F   /* 深灰黑 - 主文本色 */
--text-secondary: #6B7280 /* 中灰色 - 次要文本 */
--border: #F2F2F2         /* 浅灰 - 边框色 */
```

#### 字体系统
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
  'Helvetica Neue', 'Arial', 'Noto Sans', sans-serif;
```

#### 组件样式特征
- **输入框**: 纯白背景、无圆角、无阴影、极简风格
- **主按钮**: 背景 #1777FF、白色文字、胶囊圆角 (9999px)
- **次要按钮**: 白色背景、边框 #F2F2F2、圆角 12px、柔和阴影
- **卡片**: 圆角 12px、白色背景、微弱阴影

### 3.2 页面结构

#### 首页 (`/`) - 主要工作区

1. **顶部导航栏**
   - Logo + 居中标题"抖音去水印"
   - 右侧登录按钮（二期预留）

2. **Hero 区域**
   - 大标题："输入抖音链接，一键解析下载"
   - 简洁描述文案

3. **核心输入区**
   - 输入框：大尺寸、居中、极简风格
   - "立即解析"按钮：#1777FF 蓝色、胶囊圆角

4. **结果展示区**（解析成功后显示）
   - 视频卡片：封面图 + 标题 + 下载按钮
   - 图集网格：3 列瀑布流布局
   - 一键下载全部按钮

#### 响应式设计
- **PC 端**: 最大宽度 1200px、居中布局、图集 3 列
- **移动端**: 单列布局、输入框全宽、图集 2 列

### 3.3 核心组件

```
components/
├── ParseInput.tsx      # 输入框组件（支持粘贴检测）
├── VideoCard.tsx       # 视频结果卡片
├── ImageGrid.tsx       # 图集网格展示
├── DownloadButton.tsx  # 统一样式下载按钮
└── ui/
    ├── Button.tsx      # 基础按钮组件
    ├── Card.tsx        # 基础卡片组件
    ├── Input.tsx       # 基础输入框组件
    └── Toast.tsx       # 消息提示组件
```

---

## 4. 数据流与状态管理

### 4.1 状态管理方案（Zustand）

```typescript
// stores/parseStore.ts
interface ParseStore {
  // 解析状态
  isLoading: boolean
  result: ParseResult | null
  error: string | null

  // 操作方法
  parseUrl: (url: string) => Promise<void>
  reset: () => void
}

interface ParseResult {
  type: 'video' | 'images'
  title: string
  cover: string
  // 视频结果
  videoUrl?: string
  // 图集结果
  images?: string[]
}
```

### 4.2 完整数据流

1. **用户输入** → `ParseInput` 组件
2. **提交解析** → 调用 `parseUrl(url)` → Zustand action
3. **请求发送** → Next.js API Route: `POST /api/parse`
4. **代理转发** → API Route 转发到 Docker 内部开源 API
5. **处理响应**:
   - 成功: 提取无水印链接 → 更新 `result` → 展示结果
   - 失败: 设置 `error` → 显示 Toast 提示
6. **下载操作** → 直接请求第三方链接（需添加 Referer 头）

### 4.3 错误处理策略

| 错误场景 | 处理方式 |
|---------|---------|
| URL 格式无效 | 前端正则校验 + 实时提示 |
| API 超时 | 30 秒超时 + "解析超时，请重试" |
| 链接无效 | 区分"链接无效"、"视频不存在" |
| 接口错误 | 友好错误提示 + 重试按钮 |
| 防盗链处理 | API Route 自动添加 Referer 头 |

---

## 5. 后端 API 设计

### 5.1 Next.js API Route

```typescript
// app/api/parse/route.ts
export async function POST(req: Request) {
  const { url } = await req.json()

  // 1. 验证 URL 格式（抖音链接正则）
  // 2. 转发到内部 Docker 容器
  // 3. 添加 Referer 头处理防盗链
  // 4. 返回解析结果
}
```

### 5.2 核心依赖

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "zustand": "^4.5.0",
    "axios": "^1.6.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  }
}
```

---

## 6. Docker 容器化配置

### 6.1 Docker Compose 配置

```yaml
version: '3.8'

services:
  frontend:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - douyin-api
    environment:
      - DOUYIN_API_URL=http://douyin-api:8080
    volumes:
      - ./app:/app/app
      - ./components:/app/components
      - ./lib:/app/lib
      - ./stores:/app/stores
    restart: unless-stopped

  douyin-api:
    image: evil0ctal/douyin_tiktok_download_api:latest
    ports:
      - "8080:8080"
    restart: unless-stopped
    # 不对外暴露，仅内部网络访问
```

### 6.2 Next.js Dockerfile

```dockerfile
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

---

## 7. 项目目录结构

```
unmark/
├── app/
│   ├── (main)/
│   │   ├── page.tsx           # 首页
│   │   ├── layout.tsx         # 布局
│   │   └── globals.css        # 全局样式
│   ├── api/
│   │   └── parse/
│   │       └── route.ts       # 解析 API
│   └── favicon.ico
├── components/
│   ├── ParseInput.tsx         # 输入框
│   ├── VideoCard.tsx          # 视频卡片
│   ├── ImageGrid.tsx          # 图集网格
│   └── ui/                    # 基础 UI 组件
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Input.tsx
│       └── Toast.tsx
├── lib/
│   ├── utils.ts               # 工具函数
│   ├── constants.ts           # 常量配置
│   └── validators.ts          # 验证器
├── stores/
│   └── parseStore.ts          # Zustand 状态
├── public/                    # 静态资源
├── types/
│   └── index.ts               # TypeScript 类型定义
├── docs/
│   └── plans/
│       └── 2026-02-27-unmark-design.md
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
└── .env.local
```

---

## 8. 开发阶段规划

### 阶段 1: 项目初始化
- 创建 Next.js 项目
- 配置 Tailwind CSS
- 设置 TypeScript
- 配置 Docker 环境

### 阶段 2: UI 基础框架
- 创建 Layout 和全局样式
- 实现 UI 设计系统
- 基础组件开发（Button, Input, Card）

### 阶段 3: 核心功能开发
- 输入框组件（支持粘贴检测）
- Zustand 状态管理
- 视频卡片组件
- 图集网格组件

### 阶段 4: 后端 API 对接
- 实现 `/api/parse` 路由
- Docker 集成测试
- 错误处理完善

### 阶段 5: 响应式适配
- PC 端布局优化
- 移动端适配测试
- 跨浏览器测试

### 阶段 6: 自动化测试
- 单元测试
- E2E 测试
- 性能测试

### 阶段 7: 生产环境部署
- Docker 生产镜像构建
- Nginx 反向代理配置
- 域名 + SSL 配置

---

## 9. 技术选型总结

| 技术领域 | 选型 | 理由 |
|---------|------|------|
| 前端框架 | Next.js 14+ | 全栈能力、SEO 友好、App Router |
| 样式方案 | Tailwind CSS | 快速开发、设计一致性 |
| 状态管理 | Zustand | 轻量、易扩展、TypeScript 友好 |
| HTTP 客户端 | Axios | 拦截器、超时控制、错误处理 |
| 容器化 | Docker Compose | 简化部署、环境一致性 |
| 解析引擎 | Evil0ctal API | 成熟稳定、Docker 支持 |

---

## 10. 后续扩展规划（二期）

### 10.1 用户系统
- 微信扫码登录
- JWT 认证
- 用户信息管理

### 10.2 付费功能
- 会员等级体系
- 次数限制
- 支付接口对接

### 10.3 平台扩展
- 快手、小红书、B站等平台支持
- 统一解析接口设计

---

**设计文档版本**: v1.0
**最后更新**: 2026-02-27
