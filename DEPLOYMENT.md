# Unmark 部署指南

本文档详细介绍如何在不同环境中部署 Unmark 项目。

---

## 📋 部署前准备

### 系统要求

#### 最低配置
- **CPU**: 2核
- **内存**: 4GB RAM
- **磁盘**: 20GB 可用空间
- **系统**: Linux/Windows/macOS

#### 推荐配置
- **CPU**: 4核+
- **内存**: 8GB RAM
- **磁盘**: 50GB SSD
- **系统**: Ubuntu 20.04+ / CentOS 8+

### 软件依赖

- Node.js 18.17+
- pnpm 8+ / npm 9+ / yarn 1.22+
- Docker 20.10+
- Docker Compose 2.0+

---

## 🐳 Docker 部署（推荐）

### 方式一：使用 Docker Compose（推荐）

#### 1. 克隆项目

```bash
git clone https://github.com/your-username/unmark.git
cd unmark
```

#### 2. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`：
```env
DOUYIN_API_URL=http://localhost:8080
```

#### 3. 配置 Cookie

编辑 `config.yaml` 文件的第11行，替换为您的抖音Cookie：

```bash
# 获取Cookie方法：
# 1. 浏览器打开 https://www.douyin.com 并登录
# 2. F12 → Console → 输入：document.cookie
# 3. 复制Cookie并替换到 config.yaml 第11行
```

#### 4. 启动服务

```bash
# 启动所有容器（前台）
docker compose up

# 启动所有容器（后台）
docker compose up -d

# 查看日志
docker compose logs -f
```

#### 5. 验证部署

```bash
# 检查容器状态
docker ps

# 测试后端API
curl http://localhost:8080/docs

# 测试前端
curl http://localhost:3001
```

#### 6. 停止服务

```bash
# 停止所有容器
docker compose down

# 停止并删除数据卷
docker compose down -v
```

### 方式二：使用 Docker 命令

#### 1. 拉取镜像

```bash
docker pull evil0ctal/douyin_tiktok_download_api:latest
```

#### 2. 运行API容器

```bash
docker run -d \
  --name unmark-douyin-api \
  -p 8080:80 \
  -v $(pwd)/config.yaml:/app/crawlers/douyin/web/config.yaml:ro \
  evil0ctal/douyin_tiktok_download_api:latest
```

---

## 🖥️ 传统部署

### 生产环境部署

#### 1. 构建应用

```bash
# 安装依赖
pnpm install

# 构建生产版本
pnpm build

# 输出目录：.next/
```

#### 2. 使用 PM2 运行

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start npm --name "unmark" -- start

# 查看状态
pm2 status

# 查看日志
pm2 logs unmark

# 设置开机自启
pm2 startup
pm2 save
```

#### 3. 使用 Nginx 反向代理

创建 Nginx 配置文件 `/etc/nginx/sites-available/unmark`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 后端API
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/unmark /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🌐 云服务部署

### Vercel 部署（前端）

#### 1. 安装 Vercel CLI

```bash
npm install -g vercel
```

#### 2. 登录并部署

```bash
vercel login
vercel
```

#### 3. 环境变量配置

在 Vercel 控制台添加环境变量：
```
DOUYIN_API_URL=https://your-douyin-api.com
```

### Railway/Render 部署（全栈）

#### 1. Fork 项目到 GitHub

#### 2. 在 Railway/Render 导入项目

#### 3. 配置环境变量和Root Directory

### 阿里云/腾讯云部署

#### 1. 准备服务器

购买轻量应用服务器或云服务器。

#### 2. 安装环境

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 pnpm
npm install -g pnpm

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-uname -m" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 3. 部署应用

```bash
# 克隆项目
git clone https://github.com/your-username/unmark.git
cd unmark

# 配置环境
cp .env.example .env.local
# 编辑 .env.local 和 config.yaml

# 启动服务
docker compose up -d

# 配置防火墙
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

## 🔒 安全配置

### 1. 配置 HTTPS（使用 Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

### 2. 配置防火墙

```bash
# 允许SSH
sudo ufw allow 22

# 允许HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# 启用防火墙
sudo ufw enable
```

### 3. 限制API访问（可选）

如果需要限制API访问，可以：

1. 在Nginx中添加IP白名单
2. 使用API密钥认证
3. 配置速率限制

---

## 📊 监控和日志

### 查看容器日志

```bash
# 查看所有日志
docker compose logs

# 查看特定容器日志
docker logs unmark-douyin-api-1 -f

# 查看最近100行日志
docker logs --tail 100 unmark-douyin-api-1
```

### 查看应用日志

```bash
# PM2 日志
pm2 logs unmark

# Next.js 构建日志
cat .next/trace
```

---

## 🔄 更新部署

### Docker Compose 更新

```bash
# 拉取最新代码
git pull

# 拉取最新镜像
docker compose pull

# 重启服务
docker compose up -d --build
```

### PM2 更新

```bash
# 拉取最新代码
git pull

# 安装依赖
pnpm install

# 构建应用
pnpm build

# 重启服务
pm2 restart unmark
```

---

## 🎯 性能优化

### 1. 启用 Next.js 优化

```javascript
// next.config.js
module.exports = {
  swcMinify: true,
  reactStrictMode: true,
  compress: true,
}
```

### 2. 配置 Nginx 缓存

```nginx
# 静态文件缓存
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# API响应缓存
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m;
```

### 3. 启用 gzip 压缩

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

---

## 📋 部署检查清单

部署前：
- [ ] 已配置 `.env.local` 文件
- [ ] 已配置 `config.yaml` 中的 Cookie
- [ ] 已测试所有功能正常工作
- [ ] 已检查系统资源是否充足

部署后：
- [ ] 前端可访问
- [ ] 后端API可访问
- [ ] 解析功能正常
- [ ] 下载功能正常
- [ ] 日志正常输出
- [ ] 监控告警配置完成

---

## 🔧 故障排查

### 问题1：容器无法启动

```bash
# 检查Docker服务
sudo systemctl status docker

# 查看详细错误
docker compose logs

# 检查端口占用
netstat -ano | findstr :8080
```

### 问题2：API返回400错误

```bash
# 检查Cookie配置
docker exec unmark-douyin-api-1 head -11 /app/crawlers/douyin/web/config.yaml

# 查看容器日志
docker logs unmark-douyin-api-1 --tail 50

# 重启容器
docker compose restart douyin-api
```

### 问题3：前端无法连接后端

```bash
# 检查网络连接
docker network ls
docker network inspect unmark_default

# 测试API连通性
curl http://localhost:8080/docs
```

---

## 📞 技术支持

- 文档：[项目文档](./README.md)
- 问题反馈：[GitHub Issues](https://github.com/your-username/unmark/issues)
- 邮箱：support@example.com

---

**最后更新**: 2026-02-27
