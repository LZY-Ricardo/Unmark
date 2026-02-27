# Unmark - 抖音去水印解析工具

<div align="center">

**一个轻量、优雅的抖音视频和图集去水印解析工具**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15.5+-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4+-38B2AC.svg)](https://tailwindcss.com/)

[功能特性](#功能特性) • [快速开始](#快速开始) • [使用指南](#使用指南) • [文档](#文档)

</div>

---

## ✨ 功能特性

### 🎯 核心功能
- ✅ **视频解析** - 支持抖音短视频无水印下载
- ✅ **图集解析** - 支持抖音图文作品批量下载
- ✅ **智能识别** - 自动识别内容类型（视频/图集）
- ✅ **一键下载** - 批量下载图集中的所有图片
- ✅ **智能提取** - 自动从分享口令中提取链接
- ✅ **真实文件下载** - 使用 Fetch + Blob 实现真正的跨域下载

### 🎨 用户体验
- **像素级设计** - 复刻 [ai.codefather.cn/painting](https://ai.codefather.cn/painting) 的UI风格
- **响应式布局** - 完美适配PC和移动端
- **实时反馈** - 下载进度、状态提示
- **快速解析** - 秒级响应，即时获取结果

### 🛠️ 技术栈
- **前端框架**: Next.js 15.5+ (App Router)
- **开发语言**: TypeScript 5.0+
- **样式方案**: Tailwind CSS 3.4+
- **状态管理**: Zustand
- **爬虫引擎**: [Evil0ctal/Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API)
- **容器化**: Docker & Docker Compose

---

## 🚀 快速开始

### 环境要求
- Node.js 18.17+
- pnpm 8+ (推荐) 或 npm/yarn
- Docker Desktop (用于后端API)

### 1. 克隆项目

```bash
git clone https://github.com/your-username/unmark.git
cd unmark
```

### 2. 安装依赖

```bash
# 使用 pnpm (推荐)
pnpm install

# 或使用 npm
npm install

# 或使用 yarn
yarn install
```

### 3. 配置环境变量

复制环境变量模板：
```bash
cp .env.example .env.local
```

编辑 `.env.local`：
```bash
# 后端API地址
DOUYIN_API_URL=http://localhost:8080

# 模拟模式（用于前端测试，无需 Docker）
# MOCK_MODE=true
```

### 4. 启动Docker容器

```bash
# 启动后端API服务
docker compose up -d

# 查看容器状态
docker ps

# 查看日志
docker logs unmark-douyin-api-1 -f
```

### 5. 配置Cookie（重要！）

抖音API需要有效Cookie才能正常工作。请按照以下步骤配置：

#### 详细步骤：
1. 在浏览器中打开 https://www.douyin.com 并登录
2. 按 `F12` 打开开发者工具
3. 切换到 `Console` 标签
4. 输入并执行：`document.cookie`
5. 复制显示的Cookie字符串
6. 打开 `config.yaml` 文件
7. 找到 `Cookie:` 行（第11行）
8. 替换为您的Cookie
9. 重启容器：`docker compose restart douyin-api`

**注意事项：**
- Cookie会定期过期（几小时到几天）
- 解析失败时需要重新获取Cookie
- 确保Cookie包含必需字段：`__ac_nonce`、`__ac_signature`、`ttwid`、`s_v_web_id`、`IsDouyinActive`

### 6. 启动开发服务器

```bash
# 启动Next.js开发服务器
pnpm dev

# 或使用 npm
npm run dev

# 或使用 yarn
yarn dev
```

### 7. 访问应用

打开浏览器访问：**http://localhost:3001**

---

## 📖 使用指南

### 输入格式

#### 格式1：纯URL链接
```
https://v.douyin.com/4evJ3qVn5HA/
```

#### 格式2：完整分享口令（推荐）
```
2.07 复制打开抖音，看看【ACEn的图文作品】喜欢这样的世界 但世界不喜欢我。# 上杉绘梨衣 #... https://v.douyin.com/4evJ3qVn5HA/ 09/14 h@O.XM qRk:/
```

**系统会自动提取URL并解析！**

### 操作步骤

1. **打开网站** - 访问 http://localhost:3001
2. **粘贴链接** - 粘贴抖音分享链接或完整分享口令
3. **点击解析** - 点击"立即解析"按钮
4. **查看结果** - 等待约2秒查看解析结果
5. **下载内容** -
   - 视频：点击"下载视频"按钮
   - 图集：点击单张图片"保存"或"一键下载全部"

---

## 📂 项目结构

```
unmark/
├── app/                      # Next.js App Router
│   ├── api/                 # API路由
│   │   └── parse/          # 解析接口
│   ├── (main)/             # 主应用
│   │   ├── layout.tsx     # 布局
│   │   └── page.tsx       # 首页
│   └── layout.tsx         # 根布局
├── components/              # React组件
│   ├── ui/                # UI组件库
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── Toast.tsx
│   ├── ImageGrid.tsx     # 图集展示组件
│   ├── ParseInput.tsx    # 输入组件
│   ├── VideoCard.tsx     # 视频展示组件
│   └── ResultDisplay.tsx # 结果展示组件
├── lib/                    # 工具函数
│   └── utils.ts          # 通用工具函数
├── stores/                 # Zustand状态管理
│   └── parseStore.ts     # 解析状态
├── public/                 # 静态资源
├── types/                  # TypeScript类型定义
│   └── index.ts
├── docker-compose.yml      # Docker编排配置
├── config.yaml            # API配置文件（需手动配置Cookie）
├── .env.example           # 环境变量模板
└── package.json           # 项目配置
```

---

## 🔧 开发指南

### 可用脚本

```bash
# 开发
pnpm dev              # 启动开发服务器
pnpm build            # 构建生产版本
pnpm start            # 启动生产服务器

# Docker
docker compose up    # 启动所有容器
docker compose down  # 停止所有容器
docker compose logs  # 查看日志

# 代码质量
pnpm lint            # 代码检查
pnpm format          # 代码格式化
```

---

## 📚 相关文档

- **[USAGE.md](USAGE.md)** - 详细使用指南
- **[SOLUTION.md](SOLUTION.md)** - 问题解决方案
- **[DOWNLOAD_FIX.md](DOWNLOAD_FIX.md)** - 下载功能修复说明
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - 部署指南
- **[CHANGELOG.md](CHANGELOG.md)** - 变更日志

---

## 🎯 开发进度

- [x] 阶段 1: 项目初始化
- [x] 阶段 2: UI 基础框架
- [x] 阶段 3: 核心功能开发
- [x] 阶段 4: 后端 API 对接
- [x] 阶段 5: 响应式适配
- [x] 阶段 6: 智能URL提取功能
- [x] 阶段 7: 图片/视频下载优化
- [ ] 阶段 8: 自动化测试（待开发）
- [ ] 阶段 9: 生产环境部署（待开发）

---

## 🐛 常见问题

### 1. 解析失败："API 返回错误 400"

**原因：** Cookie已过期或配置不正确

**解决方案：**
- 按照"配置Cookie"章节重新获取Cookie
- 确保Cookie包含所有必需字段
- 重启Docker容器：`docker compose restart douyin-api`

### 2. 图片下载会打开新页面

**原因：** 跨域图片下载需要特殊处理

**解决方案：**
- 已使用 Fetch + Blob 方式修复
- 如果仍有问题，检查浏览器控制台错误信息

### 3. Docker容器无法启动

**原因：** 端口冲突或配置文件错误

**解决方案：**
```bash
# 检查端口占用
netstat -ano | findstr :8080

# 检查配置文件语法
docker compose config

# 查看详细错误
docker compose logs
```

### 4. 前端无法连接后端API

**原因：** 容器未启动或端口配置错误

**解决方案：**
```bash
# 检查容器状态
docker ps

# 检查端口映射
docker port unmark-douyin-api-1

# 测试API
curl http://localhost:8080/docs
```

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

## 🙏 致谢

- [Evil0ctal/Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API) - 开源抖音解析API
- [ai.codefather.cn/painting](https://ai.codefather.cn/painting) - UI设计参考
- Next.js 团队
- Tailwind CSS 团队

---

## 📮 联系方式

- 项目主页：[GitHub Repository](https://github.com/your-username/unmark)
- 问题反馈：[Issues](https://github.com/your-username/unmark/issues)

---

<div align="center">

**Made with ❤️**

**最后更新**: 2026-02-27 | **版本**: 1.0.0

</div>
