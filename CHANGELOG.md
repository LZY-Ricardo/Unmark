# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-27

### 🎉 首次发布

#### 新增功能
- ✅ 抖音视频解析功能
  - 支持短链接解析
  - 支持完整链接解析
  - 自动识别视频类型
- ✅ 抖音图集解析功能
  - 支持图文作品解析
  - 网格展示所有图片
  - 图片预览功能
- ✅ 智能URL提取
  - 从分享口令中自动提取URL
  - 支持多种输入格式
  - 实时URL验证
- ✅ 无水印下载
  - 视频无水印下载
  - 图片批量下载
  - 单张图片保存
- ✅ 响应式设计
  - PC端完美适配
  - 移动端优化布局
- ✅ 优雅的UI设计
  - 复刻参考网站设计
  - 流畅的动画效果
  - 直观的用户交互

#### 技术栈
- **前端框架**: Next.js 15.5+ (App Router)
- **开发语言**: TypeScript 5.0+
- **样式方案**: Tailwind CSS 3.4+
- **状态管理**: Zustand
- **容器化**: Docker + Docker Compose
- **解析引擎**: Evil0ctal/Douyin_TikTok_Download_API

#### 项目结构
```
unmark/
├── app/                      # Next.js App Router
├── components/              # React组件
│   ├── ui/                # UI组件库
│   ├── ParseInput.tsx    # 输入组件
│   ├── VideoCard.tsx     # 视频卡片
│   └── ImageGrid.tsx     # 图集网格
├── stores/                 # Zustand状态管理
├── lib/                    # 工具函数
├── types/                  # TypeScript类型
├── docker-compose.yml      # Docker编排
└── config.yaml            # API配置
```

#### 已知限制
- Cookie需要定期手动更新（过期时间：几小时到几天）
- 依赖第三方API的稳定性
- 需要Docker环境运行后端API

#### 使用说明
1. 配置 `config.yaml` 中的Cookie
2. 启动Docker容器：`docker compose up -d`
3. 启动前端服务：`pnpm dev`
4. 访问 http://localhost:3001

---

## [Unreleased]

### 计划中的功能
- [ ] 用户登录系统
- [ ] 支付功能
- [ ] 批量链接解析
- [ ] 解析历史记录
- [ ] TikTok平台支持
- [ ] 快手/视频号支持

### 性能优化
- [ ] 添加Redis缓存
- [ ] CDN加速
- [ ] 图片懒加载优化

---

## 变更说明

### [1.0.0] - 2026-02-27 - 首次发布

#### 重大更新
- 🎯 完成核心功能开发
- 🎨 实现像素级UI设计
- 🐳 完成Docker容器化部署
- 📝 完善项目文档

#### 功能详情

**核心功能**
- 抖音视频/图集解析
- 智能URL提取
- 无水印内容下载
- 批量图片下载

**用户体验**
- 实时状态反馈
- 下载进度显示
- 错误提示优化
- 响应式布局

**技术实现**
- Fetch + Blob 跨域下载
- Zustand 状态管理
- Docker容器编排
- TypeScript类型安全

#### 修复的问题

**问题1：Cookie配置不正确**
- 描述：初始Cookie缺少 `ttwid` 字段
- 影响：API返回400错误
- 解决：添加完整的Cookie配置
- 文件：`config.yaml`

**问题2：API数据结构解析错误**
- 描述：期望 `apiData.aweme_detail` 但实际是 `apiData.data`
- 影响：前端无法解析API响应
- 解决：修改数据路径
- 文件：`app/api/parse/route.ts`

**问题3：图片下载打开新页面**
- 描述：跨域图片无法直接下载
- 影响：用户体验差
- 解决：使用Fetch + Blob实现真实下载
- 文件：`lib/utils.ts`

**问题4：分享口令无法识别**
- 描述：用户粘贴完整分享口令时解析失败
- 影响：用户需要手动提取URL
- 解决：添加智能URL提取功能
- 文件：`lib/utils.ts`, `components/ParseInput.tsx`

#### 文档更新
- 新增 `README.md` - 项目主文档
- 新增 `USAGE.md` - 使用指南
- 新增 `SOLUTION.md` - 问题解决方案
- 新增 `DOWNLOAD_FIX.md` - 下载功能修复说明
- 新增 `DEPLOYMENT.md` - 部署指南
- 新增 `CHANGELOG.md` - 变更日志（本文件）

#### 依赖更新

**生产依赖**
```json
{
  "next": "15.5.12",
  "react": "^19.0.0",
  "typescript": "^5.7.2",
  "tailwindcss": "^3.4.17",
  "zustand": "^5.0.2"
}
```

**开发依赖**
```json
{
  "@types/node": "^22.10.5",
  "@types/react": "^19.0.11",
  "eslint": "^9.18.0",
  "eslint-config-next": "^15.5.12"
}
```

**Docker镜像**
- `evil0ctal/douyin_tiktok_download_api:latest`

#### 开发环境

**Node版本**: 18.17.0+
**包管理器**: pnpm 8.15.6+
**Docker版本**: 27.4.0
**Docker Compose版本**: 2.32.4

---

## 版本命名规则

本项目遵循语义化版本控制（Semantic Versioning）：

- **主版本号（MAJOR）**: 不兼容的API变更
- **次版本号（MINOR）**: 向下兼容的功能新增
- **修订号（PATCH）**: 向下兼容的问题修复

示例：`1.0.0` → `1.1.0` → `2.0.0`

---

## 贡献指南

如需贡献代码，请遵循以下流程：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 时间线

- **2026-02-27**: v1.0.0 首次发布
  - 完成核心功能
  - 实现UI设计
  - 完成Docker部署
  - 编写完整文档

---

**维护者**: Development Team
**最后更新**: 2026-02-27
