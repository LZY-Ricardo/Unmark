# 可靠性与发布流程（免费版）

## 1. 可用性监控与告警

### 监控目标
- 站点主页：`https://unmark.ricardoiyu.top`
- 健康检查 API：`https://unmark.ricardoiyu.top/api/health`

### UptimeRobot 建议配置
- Monitor Type: `HTTP(s)`
- Monitoring Interval: `5 minutes`
- Alert Contacts: 邮箱 + Telegram（建议两种）
- Alert when down for: `1 minute`
- Keyword Monitor（可选）:
  - URL: `/api/health`
  - Keyword: `"status":"ok"`

### Vercel Runtime Logs 建议
- 打开 Vercel 项目 `unmark-free` -> `Logs` -> `Runtime Logs`
- 保存筛选器：
  - `Environment = Production`
  - `Status Code = 5xx`
  - `Path contains /api/parse`
- 打开日志通知（邮箱/Slack）

## 2. API 防滥用（已实现）

`/api/parse` 已加入按 `IP + User-Agent` 的窗口限流。

### 可调环境变量
- `PARSE_RATE_LIMIT_MAX`：每窗口最大请求数，默认 `30`
- `PARSE_RATE_LIMIT_WINDOW_MS`：窗口时长（毫秒），默认 `60000`

### 超限返回
- HTTP `429`
- Header:
  - `Retry-After`
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## 3. 固化发布流程

### GitHub Actions（已实现）
- 工作流文件：`.github/workflows/build-check.yml`
- 触发条件：
  - `pull_request -> main`
  - `push -> main`
- 校验项：`npm ci` + `npm run build`

### Vercel 生产分支策略（需要控制台设置）
- Vercel -> Project Settings -> Git
- `Production Branch` 设置为 `main`
- 这样 `main` 自动部署生产，其他分支只生成 Preview

### 上线前固定动作
- 本地先执行：`npm run release:check`
- 通过后再合并或部署
