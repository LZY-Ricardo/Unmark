# 多平台支持架构说明

## 🎯 设计理念

**混合架构模式** - 根据平台特性自动选择最优解析方案：

```
智能路由层（/api/parse）
    ↓
    ├── 抖音 → 无Cookie模式（无需Docker，快速、安全）
    │
    ├── TikTok → Docker后端（需要API支持）
    │
    ├── 快手 → Docker后端（需要API支持）
    │
    └── 其他平台 → Docker后端
```

---

## 📊 平台支持情况

### ✅ 已实现（无Cookie模式）

| 平台 | 状态 | 方式 | 需要Docker | 说明 |
|------|------|------|-----------|------|
| **抖音** | ✅ 完成 | 无Cookie | ❌ 否 | 完全本地解析 |
| **抖音图集** | ✅ 完成 | 无Cookie | ❌ 否 | 批量下载支持 |

### 🔄 待实现（Docker后端）

| 平台 | 状态 | 方式 | 需要Docker | 说明 |
|------|------|------|-----------|------|
| **TikTok** | 🔄 计划中 | Docker后端 | ✅ 是 | 需要后端API支持 |
| **快手** | 🔄 计划中 | Docker后端 | ✅ 是 | 需要后端API支持 |
| **小红书** | 🔄 计划中 | Docker后端 | ✅ 是 | 需要后端API支持 |
| **B站** | 🔄 计划中 | Docker后端 | ✅ 是 | 需要后端API支持 |

---

## 🏗️ 架构设计

### 智能路由层

```typescript
// app/api/parse/route.ts
export async function POST(request: NextRequest) {
  const { url } = await request.json();

  // 1. 检测平台
  const platform = detectPlatform(url);

  // 2. 根据平台选择解析方式
  if (platform === 'douyin') {
    return await parseDouyinNoCookie(url);  // 无Cookie
  } else {
    return await parseWithBackend(url);      // Docker后端
  }
}
```

### 平台检测

```typescript
function detectPlatform(url: string): string {
  if (url.includes('douyin.com')) return 'douyin';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('kuaishou.com')) return 'kuaishou';
  // ...
}
```

---

## 🚀 部署方式

### 方案A：仅部署前端（仅抖音）

```bash
# 适合只需要抖音功能的场景
pnpm build
pnpm start
```

**优势：**
- ✅ 零配置
- ✅ 无需Docker
- ✅ 部署简单

**限制：**
- ❌ 仅支持抖音

---

### 方案B：前端 + Docker后端（全平台）

```bash
# 1. 启动Docker后端
docker compose up -d

# 2. 启动前端
pnpm build
pnpm start
```

**优势：**
- ✅ 支持多平台
- ✅ 智能降级
- ✅ 扩展性强

**要求：**
- ⚠️ 需要配置Cookie（其他平台）
- ⚠️ 需要Docker环境

---

### 方案C：渐进式部署（推荐）⭐

**阶段1：仅前端（当前）**
```bash
# 现在就可用
pnpm dev
# 支持抖音无Cookie解析
```

**阶段2：添加Docker后端（需要时）**
```bash
# 当需要其他平台时
docker compose up -d
# 自动切换到多平台模式
```

**优势：**
- ✅ 立即可用（抖音）
- ✅ 按需扩展（其他平台）
- ✅ 灵活降级

---

## 📝 配置说明

### 环境变量

```bash
# .env.local

# Docker后端API地址（可选，用于其他平台）
DOUYIN_API_URL=http://localhost:8080

# 如果不配置此变量：
# - 抖音仍然可以正常使用（无Cookie模式）
# - 其他平台会提示"暂不支持"
```

### 降级策略

```typescript
// 智能降级逻辑
try {
  // 优先使用无Cookie模式
  return await parseDouyinNoCookie(url);
} catch (error) {
  // 降级到Docker后端
  if (backendAvailable) {
    return await parseWithBackend(url);
  }
  throw new Error('解析失败，请检查Docker后端是否运行');
}
```

---

## 🎯 使用场景

### 场景1：只需要抖音

```
用户: 只需要抖音功能
部署: 仅前端
Docker: 不需要
配置: 零配置
```

### 场景2：需要多平台

```
用户: 需要TikTok、快手等
部署: 前端 + Docker
Docker: 需要
配置: 需要配置各平台Cookie
```

### 场景3：渐进式扩展（推荐）

```
阶段1: 仅前端 → 抖音功能立即可用
阶段2: 需要时添加Docker → 扩展到其他平台
优势: 灵活、按需扩展
```

---

## 🔧 实现细节

### 新增文件

- `app/api/parse/route.ts` - 智能路由（新建）
- `lib/platform_detector.ts` - 平台检测工具（新建）
- `lib/backend_parser.ts` - Docker后端解析器（新建）

### 修改文件

- `stores/parseStore.ts` - 使用统一API `/api/parse`

### 保留文件

- `app/api/parse-no-cookie/route.ts` - 抖音专用（保留）
- `docker-compose.yml` - Docker配置（保留）
- `config.yaml` - 后端配置（保留）

---

## 📊 对比表

| 特性 | 仅前端 | 前端+Docker |
|------|--------|-------------|
| **抖音支持** | ✅ 无Cookie | ✅ 无Cookie |
| **TikTok支持** | ❌ 不支持 | ✅ 后端API |
| **快手支持** | ❌ 不支持 | ✅ 后端API |
| **其他平台** | ❌ 不支持 | ✅ 可扩展 |
| **部署难度** | 🟢 简单 | 🟡 中等 |
| **维护成本** | 🟢 低 | 🟡 中 |
| **Cookie配置** | ❌ 不需要 | ✅ 需要 |

---

## ✅ 推荐方案

**对于您当前的需求：**

### 现阶段（仅抖音）

```bash
# ✅ 使用现有方案即可
pnpm dev

# 无需Docker
# 无需Cookie配置
# 抖音功能完全正常
```

### 未来扩展（多平台）

```bash
# ✅ 当需要其他平台时
# 1. 启动Docker
docker compose up -d

# 2. 配置环境变量
echo "DOUYIN_API_URL=http://localhost:8080" >> .env.local

# 3. 重启前端
pnpm dev

# ✨ 自动支持多平台
```

---

## 🎉 总结

**Docker后端的价值：**
1. ✅ 支持多平台扩展
2. ✅ 作为备用解析方案
3. ✅ 提供更强大的API功能

**保留Docker的优势：**
- 抖音：无Cookie模式（快速、安全）
- 其他平台：Docker后端（可扩展）
- 灵活降级（高可用）

**所以您的想法是对的！**

建议保留Docker相关文件，以备将来扩展使用。👍

---

**最后更新**: 2026-02-27
**版本**: 1.1.0 - 混合架构模式
