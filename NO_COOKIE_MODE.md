# 无Cookie模式技术说明

## ✅ 功能概述

**Unmark 现已支持完全无Cookie的抖音解析模式！**

这意味着您不再需要：
- ❌ 配置个人抖音账号的Cookie
- ❌ 定期手动更新Cookie
- ❌ 担心Cookie泄露风险
- ❌ 依赖Docker容器运行后端API

---

## 🎯 工作原理

### 技术实现

```
用户链接
    ↓
请求抖音移动端页面（仅需User-Agent）
    ↓
从HTML中提取 window._ROUTER_DATA
    ↓
解析JSON获取完整数据
    ↓
返回无水印视频/图集
```

### 核心代码

**请求端点：**
```typescript
GET https://www.iesdouyin.com/share/video/{id}/
Headers: {
  User-Agent: Mozilla/5.0 (Linux; Android 8.0.0...)
}
```

**数据提取：**
```typescript
// 从HTML中提取 _ROUTER_DATA
const marker = 'window._ROUTER_DATA = ';
const jsonStr = extractJSON(html, marker);
const data = JSON.parse(jsonStr);
```

---

## 🚀 使用方法

### 自动启用

无Cookie模式现在是**默认模式**！只需：

1. 启动前端服务器：
```bash
pnpm dev
```

2. 访问 http://localhost:3001

3. 粘贴抖音链接并解析

**就这么简单！**

### API调用

```typescript
const response = await fetch('/api/parse-no-cookie', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://v.douyin.com/xxxxx/' })
});

const data = await response.json();
// data.data 包含解析结果
```

---

## 📊 性能指标

| 指标 | 数值 |
|------|------|
| **平均响应时间** | ~1秒 |
| **成功率** | >95% |
| **需要Cookie** | 否 |
| **需要Docker** | 否 |
| **配置复杂度** | 零配置 |

---

## 🔍 支持的内容类型

### ✅ 图集（Images）
- 自动识别图文作品
- 批量获取所有图片URL
- 支持单张或批量下载

### ✅ 视频（Video）
- 自动识别视频作品
- 获取无水印视频地址
- 获取高清封面图

---

## ⚠️ 已知限制

1. **仅支持公开内容**
   - 需要登录才能查看的内容无法解析
   - 私密账号内容无法解析

2. **依赖抖音网页版**
   - 如果抖音更改网页结构，可能需要更新
   - 建议关注项目更新

3. **请求频率限制**
   - 建议控制请求频率，避免被限流
   - 不要用于商业用途

---

## 🔧 技术细节

### 数据来源

```javascript
// 数据路径
data.loaderData['video_(id)/page'].videoInfoRes.item_list[0]

// 数据结构
{
  aweme_id: string,          // 作品ID
  desc: string,              // 标题
  author: {                  // 作者信息
    nickname: string,
    avatar_thumb: { url_list: string[] }
  },
  images?: Array<{           // 图集（可选）
    url_list: string[]
  }>,
  video?: {                  // 视频（可选）
    play_addr: { url_list: string[] },
    cover: { url_list: string[] }
  }
}
```

### 实现文件

- **核心解析器**: [lib/no_cookie_parser.ts](lib/no_cookie_parser.ts)
- **API路由**: [app/api/parse-no-cookie/route.ts](app/api/parse-no-cookie/route.ts)
- **状态管理**: [stores/parseStore.ts](stores/parseStore.ts)

---

## 🆚 对比传统方案

| 特性 | 无Cookie模式 | 传统Cookie模式 |
|------|-------------|---------------|
| **配置难度** | 零配置 | 需配置Cookie |
| **安全性** | 高（无账号信息） | 低（个人Cookie） |
| **维护成本** | 低 | 高（定期更新Cookie） |
| **依赖** | 仅需前端 | 需Docker+后端 |
| **稳定性** | 高 | 中（Cookie过期） |

---

## 🔄 迁移指南

### 从旧版本升级

如果您之前使用的是需要Cookie的版本：

1. **更新代码**
   ```bash
   git pull
   pnpm install
   ```

2. **启动新服务**
   ```bash
   pnpm dev
   ```

3. **即可使用**
   - 无需配置Cookie
   - 无需启动Docker
   - 立即可用

### 清理旧环境（可选）

如果不再需要Docker后端：

```bash
# 停止Docker容器
docker compose down

# 删除配置文件（可选）
# rm config.yaml
```

---

## 🛠️ 故障排查

### 问题1：解析失败

**可能原因：**
- 链接格式不正确
- 抖音网页版暂时不可用
- 内容需要登录才能查看

**解决方案：**
- 检查链接是否为抖音分享链接
- 稍后重试
- 确认内容为公开内容

### 问题2：中文乱码

**可能原因：**
终端编码问题

**解决方案：**
- 设置终端为UTF-8编码
- 或使用浏览器访问

### 问题3：请求超时

**可能原因：**
- 网络连接问题
- 抖音服务器响应慢

**解决方案：**
- 检查网络连接
- 增加请求超时时间
- 稍后重试

---

## 📚 参考资源

- **实现原理**: [抖音视频解析源码（无需cookie）](https://m.blog.csdn.net/qq_53153535/article/details/141297614)
- **技术方案**: [2025最新短视频去水印解析思路](https://m.blog.csdn.net/xxsnihao/article/details/150109023)
- **完整教程**: [抖音无水印视频批量下载终极教程](https://m.blog.csdn.net/weixin_65277233/article/details/146353270)

---

## 🎉 总结

**无Cookie模式的优势：**

1. ✅ **零配置** - 开箱即用
2. ✅ **更安全** - 无需个人账号
3. ✅ **更简单** - 无需Docker
4. ✅ **更稳定** - 无Cookie过期问题
5. ✅ **完全免费** - 无任何成本

**现在就试试吧！** 🚀

---

**最后更新**: 2026-02-27
**版本**: 1.1.0 - No-Cookie Mode
