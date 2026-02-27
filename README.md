# Unmark - 抖音去水印解析网站

一个轻量级的去水印解析网站，支持抖音平台视频和图集的无水印下载。

## 项目特性

- 🎨 **现代化 UI**: 基于 Next.js 14+ 和 Tailwind CSS，像素级复刻参考网站设计
- ⚡ **快速解析**: 秒级响应，即时获取无水印内容
- 📱 **响应式设计**: 完美适配 PC、平板和移动端
- 🔐 **安全可靠**: 不存储数据，保护用户隐私
- 🐳 **容器化部署**: Docker Compose 一键部署

## 技术栈

- **前端**: Next.js 14+ (App Router) + React 19 + TypeScript
- **样式**: Tailwind CSS 3.4
- **状态管理**: Zustand
- **后端**: Next.js API Routes
- **容器化**: Docker + Docker Compose
- **解析引擎**: Evil0ctal/Douyin_TikTok_Download_API

## 快速开始

### 前置要求

- Node.js 18+ 和 npm
- Docker 和 Docker Compose（用于容器化部署）

### 开发模式

1. **安装依赖**
   ```bash
   npm install
   ```

2. **启动开发服务器**
   ```bash
   npm run dev
   ```

3. **访问应用**
   打开浏览器访问 [http://localhost:3000](http://localhost:3000)

### 生产部署（Docker）

1. **构建并启动所有容器**
   ```bash
   docker-compose up -d
   ```

2. **查看日志**
   ```bash
   docker-compose logs -f
   ```

3. **停止服务**
   ```bash
   docker-compose down
   ```

## 项目结构

```
unmark/
├── app/                    # Next.js App Router
│   ├── (main)/            # 主应用页面
│   ├── api/               # API 路由
│   └── globals.css        # 全局样式
├── components/            # React 组件
│   ├── ui/               # 基础 UI 组件
│   ├── ParseInput.tsx    # 输入框组件
│   ├── VideoCard.tsx     # 视频卡片
│   └── ImageGrid.tsx     # 图集网格
├── stores/               # Zustand 状态管理
├── lib/                  # 工具函数
├── types/                # TypeScript 类型
├── docs/                 # 项目文档
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## 环境变量

创建 `.env.local` 文件：

```env
# Docker 内部 API 地址
DOUYIN_API_URL=http://douyin-api:8080
```

## 核心功能

### 1. 链接解析
- 支持抖音短链接：`https://v.douyin.com/xxxxx/`
- 支持完整链接：`https://www.douyin.com/video/xxxxx`
- 自动识别视频和图集类型

### 2. 视频下载
- 无水印视频文件
- 原始画质保持
- 一键下载

### 3. 图集下载
- 网格展示所有图片
- 单张保存功能
- 批量下载全部

## 开发脚本

```bash
# 开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 代码检查
npm run lint
```

## 文档

- [需求文档](./docs/requirements.md)
- [API 文档](./docs/api.md)
- [项目进度](./docs/progress.md)
- [技术设计](./docs/plans/2026-02-27-unmark-design.md)

## 进度

- [x] 阶段 1: 项目初始化
- [x] 阶段 2: UI 基础框架
- [x] 阶段 3: 核心功能开发
- [x] 阶段 4: 后端 API 对接
- [ ] 阶段 5: 响应式适配
- [ ] 阶段 6: 自动化测试
- [ ] 阶段 7: 生产环境部署

## 注意事项

### 防盗链处理
API 已自动添加 Referer 和 User-Agent 头，避免被第三方服务器拦截。

### 超时设置
默认超时时间为 30 秒，可在 `app/api/parse/route.ts` 中修改。

### Docker 网络
开源 API 容器仅在 Docker 内部网络可访问，不直接暴露到公网。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题，请通过 GitHub Issues 联系。

---

**开发团队**: AI Assistant
**最后更新**: 2026-02-27
