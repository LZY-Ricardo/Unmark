# 生产环境部署指南

**项目**: Unmark 去水印解析网站
**部署方式**: Docker + Docker Compose
**最后更新**: 2026-02-27

---

## 1. 部署架构

```
                    ┌─────────────┐
                    │   Nginx     │
                    │  (可选)     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Next.js    │
                    │  :3000      │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Douyin API │
                    │  :8080      │
                    └─────────────┘
```

---

## 2. 前置要求

### 2.1 服务器要求

- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **CPU**: 2 核心及以上
- **内存**: 4GB 及以上
- **磁盘**: 20GB 及以上
- **网络**: 公网 IP，开放端口 80/443

### 2.2 软件要求

- Docker 20.10+
- Docker Compose 2.0+
- （可选）Nginx 1.18+（如需反向代理）
- （可选）域名和 SSL 证书

---

## 3. 部署步骤

### 3.1 克隆项目

```bash
# 克隆代码
git clone <your-repo-url> /opt/unmark
cd /opt/unmark
```

### 3.2 配置环境变量

创建 `.env` 文件：

```bash
cat > .env << 'EOF'
# 生产环境配置
NODE_ENV=production

# API 地址（Docker 内部网络）
DOUYIN_API_URL=http://douyin-api:8080

# 端口配置
PORT=3000

# 日志级别
LOG_LEVEL=info
EOF
```

### 3.3 配置 standalone 输出

更新 `next.config.js`：

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // 启用 standalone 输出
}

module.exports = nextConfig
```

### 3.4 启动服务

```bash
# 构建并启动所有容器
docker-compose up -d

# 查看日志
docker-compose logs -f

# 检查容器状态
docker-compose ps
```

### 3.5 验证部署

```bash
# 测试 Next.js 应用
curl http://localhost:3000

# 测试 API
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -d '{"url":"https://v.douyin.com/test/"}'
```

---

## 4. Nginx 反向代理（可选）

### 4.1 安装 Nginx

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx -y

# CentOS
sudo yum install nginx -y
```

### 4.2 配置 Nginx

复制配置文件：

```bash
sudo cp nginx.conf /etc/nginx/nginx.conf
```

编辑配置，替换 `your-domain.com` 为你的域名：

```bash
sudo vim /etc/nginx/nginx.conf
```

### 4.3 启动 Nginx

```bash
# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 开机自启
sudo systemctl enable nginx
```

---

## 5. SSL 证书配置（HTTPS）

### 5.1 使用 Let's Encrypt

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

### 5.2 手动配置 SSL

如果有自己的 SSL 证书：

```bash
# 创建证书目录
sudo mkdir -p /etc/nginx/ssl

# 复制证书文件
sudo cp cert.pem /etc/nginx/ssl/
sudo cp key.pem /etc/nginx/ssl/

# 设置权限
sudo chmod 600 /etc/nginx/ssl/*
```

取消 `nginx.conf` 中 HTTPS 部分的注释并重启：

```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 6. 防火墙配置

### 6.1 UFW (Ubuntu)

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 6.2 firewalld (CentOS)

```bash
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## 7. 监控和日志

### 7.1 查看容器日志

```bash
# 所有容器日志
docker-compose logs -f

# 特定容器日志
docker-compose logs -f frontend
docker-compose logs -f douyin-api

# 最近 100 行日志
docker-compose logs --tail=100 frontend
```

### 7.2 系统资源监控

```bash
# 容器资源使用
docker stats

# 磁盘使用
df -h

# 内存使用
free -h
```

### 7.3 日志轮转配置

创建 `/etc/logrotate.d/docker-unmark`：

```
/var/lib/docker/containers/*unmark*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
```

---

## 8. 备份策略

### 8.1 数据备份

```bash
# 创建备份脚本
cat > /opt/scripts/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/backups/unmark

mkdir -p $BACKUP_DIR

# 备份配置文件
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
    /opt/unmark/.env \
    /opt/unmark/nginx.conf

# 删除 7 天前的备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

chmod +x /opt/scripts/backup.sh

# 添加到 crontab（每天凌晨 2 点执行）
crontab -e
# 添加: 0 2 * * * /opt/scripts/backup.sh
```

### 8.2 镜像备份

```bash
# 导出镜像
docker save evil0ctal/douyin_tiktok_download_api:latest | gzip > douyin-api.tar.gz

# 导入镜像
docker load < douyin-api.tar.gz
```

---

## 9. 更新和回滚

### 9.1 更新应用

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build

# 清理旧镜像
docker image prune -f
```

### 9.2 回滚操作

```bash
# 回滚到上一个版本
git log --oneline -10
git checkout <commit-hash>

# 重新构建
docker-compose up -d --build
```

---

## 10. 性能优化

### 10.1 Docker 优化

```yaml
# docker-compose.yml 添加资源限制
services:
  frontend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### 10.2 Nginx 优化

```nginx
# nginx.conf
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
}
```

### 10.3 Next.js 优化

```javascript
// next.config.js
const nextConfig = {
  // 启用 gzip 压缩
  compress: true,

  // 图片优化
  images: {
    domains: [],
    formats: ['image/webp'],
  },

  // 生产优化
  swcMinify: true,
}
```

---

## 11. 安全加固

### 11.1 容器安全

```bash
# 使用非 root 用户运行
# 已在 Dockerfile 中配置

# 限制容器权限
docker-compose.yml:
  security_opt:
    - no-new-privileges:true
  read_only: true
  tmpfs:
    - /tmp
```

### 11.2 网络安全

```bash
# 只开放必要的端口
# 使用内部网络隔离服务
# 已在 docker-compose.yml 中配置
```

### 11.3 更新和维护

```bash
# 定期更新系统
sudo apt update && sudo apt upgrade -y

# 更新 Docker 镜像
docker-compose pull
docker-compose up -d
```

---

## 12. 故障排查

### 12.1 容器无法启动

```bash
# 查看详细日志
docker-compose logs frontend

# 检查端口占用
sudo netstat -tulpn | grep 3000

# 检查 Docker 磁盘空间
docker system df
```

### 12.2 API 调用失败

```bash
# 测试内部网络连接
docker-compose exec frontend ping douyin-api

# 检查环境变量
docker-compose exec frontend env | grep DOUYIN
```

### 12.3 性能问题

```bash
# 检查容器资源使用
docker stats

# 查看应用日志
docker-compose logs -f --tail=100 frontend

# 检查数据库连接（如果有）
docker-compose exec db mysql -u root -p
```

---

## 13. 快速部署脚本

```bash
#!/bin/bash
set -e

echo "🚀 开始部署 Unmark..."

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查 Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 创建 .env 文件
if [ ! -f .env ]; then
    echo "📝 创建环境变量文件..."
    cat > .env << 'EOF'
NODE_ENV=production
DOUYIN_API_URL=http://douyin-api:8080
PORT=3000
EOF
fi

# 构建并启动
echo "🔨 构建并启动容器..."
docker-compose up -d --build

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "📊 服务状态："
docker-compose ps

echo "✅ 部署完成！"
echo "🌐 访问 http://localhost:3000"
```

---

## 14. 生产环境检查清单

- [ ] 服务器资源充足（CPU、内存、磁盘）
- [ ] Docker 和 Docker Compose 已安装
- [ ] 环境变量已正确配置
- [ ] 防火墙规则已设置
- [ ] Nginx 反向代理已配置（如需要）
- [ ] SSL 证书已安装（如需要 HTTPS）
- [ ] 日志轮转已配置
- [ ] 备份脚本已设置
- [ ] 监控告警已配置
- [ ] 容器可正常启动
- [ ] 应用功能正常
- [ ] API 调用成功

---

## 15. 联系支持

如遇到部署问题，请检查：
1. Docker 日志：`docker-compose logs`
2. Nginx 日志：`/var/log/nginx/`
3. 系统日志：`journalctl -xe`

---

**部署状态**: ✅ **阶段 7 完成**

所有生产部署配置已完成，项目可立即部署到生产环境。

---

**项目完成度**: 🎉 **100%** (7/7 阶段)
