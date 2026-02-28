# Unmark 付费系统落地手册（V1 实施版）

更新时间：2026-02-28  
适用版本：当前 `main`（Next.js App Router + Zustand）  
关联文档：`docs/monetization-v1.md`

## 1. 文档目标

这份文档用于把“免费 1 次 + 日卡/月卡”方案落到当前代码仓库，重点回答三个问题：

1. 现有代码从哪里改，改成什么结构。
2. 后端接口、表结构、状态机如何设计。
3. 如何在 4 周内按优先级上线，并可灰度回滚。

## 2. 现状评估（基于当前仓库）

## 2.1 当前系统特点
1. 主入口是 `app/api/parse/route.ts`，前端解析请求统一走这里。
2. 前端状态集中在 `stores/parseStore.ts`，当前只处理字符串错误。
3. 当前仓库没有数据库、支付、鉴权、额度系统相关代码。
4. 项目目前依赖非常轻（无 ORM、无 Redis、无队列）。

### 2.2 当前与付费需求的差距
1. 缺用户标识：没有稳定用户 ID，就无法扣次和计费。
2. 缺额度判定：`/api/parse` 前没有权益与免费次数校验。
3. 缺支付链路：没有订单、回调、补偿任务。
4. 缺统一错误码：前端无法准确区分“解析失败”与“需要付费”。

## 3. 技术方案选型（推荐）

### 3.1 基础栈（建议）
1. 数据库：PostgreSQL（账务数据强一致，便于统计查询）。
2. ORM：Drizzle ORM（轻量，适配当前项目体量）。
3. 校验：Zod（接口入参校验，减少脏数据）。
4. 缓存/限流：先不强依赖 Redis，V1 先用 DB + 内存限流，V1.1 再引入 Redis。

### 3.2 新增依赖（建议）
```bash
npm i drizzle-orm postgres zod nanoid
npm i -D drizzle-kit tsx
```

### 3.3 新增环境变量
```env
# Billing / DB
DATABASE_URL=postgres://unmark:unmark@localhost:5432/unmark
APP_TIMEZONE=Asia/Shanghai

# Pricing / Experiment
BILLING_FREE_DAILY_LIMIT=1
BILLING_DAY_PRICE_A=290
BILLING_MONTH_PRICE_A=1990
BILLING_DAY_PRICE_B=390
BILLING_MONTH_PRICE_B=2490
BILLING_EXPERIMENT_ID=pricing_v1

# Fair use
BILLING_FAIR_USE_DAILY_SOFT_CAP=80

# Payment（示例）
PAY_PROVIDER=mock
PAY_WEBHOOK_SECRET=replace_me
```

说明：价格统一以“分”为单位存储，避免浮点误差。

## 4. 目录与文件改造清单

## 4.1 新增文件（后端）
```text
app/
  api/
    billing/
      entitlement/route.ts
      order/route.ts
      refresh/route.ts
      webhook/route.ts

lib/
  billing/
    config.ts
    errors.ts
    identity.ts
    pricing.ts
    quota.ts
    entitlement.ts
    order.ts
    analytics.ts
  db/
    client.ts
    schema.ts

scripts/
  billing-reconcile.ts
```

### 4.2 新增文件（前端）
```text
components/
  billing/
    PaywallModal.tsx
    PricingCard.tsx

stores/
  billingStore.ts

types/
  billing.ts
```

### 4.3 修改文件（现有）
1. `app/api/parse/route.ts`：接入扣次与权益校验，统一错误返回。
2. `stores/parseStore.ts`：支持识别 `PAYWALL_REQUIRED` 并弹付费层。
3. `components/ParseInput.tsx`：展示“剩余免费次数”与升级入口。
4. `types/index.ts`：增加标准错误结构，兼容旧逻辑。
5. `docker-compose.yml`：新增 `postgres` 服务（可选 `redis`）。

## 5. 数据模型与 SQL DDL（PostgreSQL）

## 5.1 枚举类型
```sql
CREATE TYPE plan_type AS ENUM ('free', 'day', 'month');
CREATE TYPE order_status AS ENUM ('created', 'paying', 'paid', 'fulfilled', 'failed', 'refunded');
CREATE TYPE entitlement_status AS ENUM ('active', 'expired', 'revoked');
CREATE TYPE pay_channel AS ENUM ('mock', 'wechat', 'alipay', 'stripe');
```

### 5.2 用户与设备
```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  anon_id VARCHAR(64) NOT NULL UNIQUE,
  device_fingerprint_hash VARCHAR(128),
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
```

### 5.3 订单
```sql
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  order_no VARCHAR(40) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  plan_type plan_type NOT NULL CHECK (plan_type IN ('day', 'month')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(8) NOT NULL DEFAULT 'CNY',
  variant VARCHAR(16) NOT NULL,                -- A / B
  experiment_id VARCHAR(64) NOT NULL,
  pay_channel pay_channel NOT NULL DEFAULT 'mock',
  status order_status NOT NULL DEFAULT 'created',
  transaction_id VARCHAR(128),                 -- 三方支付流水号
  client_request_id VARCHAR(64) NOT NULL,      -- 客户端幂等键
  paid_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uk_orders_client_request ON orders(client_request_id);
CREATE INDEX idx_orders_user_created_at ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status);
```

### 5.4 权益
```sql
CREATE TABLE entitlements (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  source_order_id BIGINT REFERENCES orders(id),
  plan_type plan_type NOT NULL CHECK (plan_type IN ('day', 'month')),
  status entitlement_status NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX idx_entitlements_user_active ON entitlements(user_id, status, ends_at DESC);
```

### 5.5 每日使用计数
```sql
CREATE TABLE usage_daily (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  usage_date DATE NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 0,
  soft_limited_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, usage_date)
);
CREATE INDEX idx_usage_daily_date ON usage_daily(usage_date DESC);
```

### 5.6 支付回调日志（幂等与审计）
```sql
CREATE TABLE payment_webhook_logs (
  id BIGSERIAL PRIMARY KEY,
  provider pay_channel NOT NULL,
  transaction_id VARCHAR(128) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, transaction_id, event_type)
);
```

### 5.7 埋点事件（可选，或写数仓）
```sql
CREATE TABLE analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_name VARCHAR(64) NOT NULL,
  user_id BIGINT REFERENCES users(id),
  variant VARCHAR(16),
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  properties JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_analytics_event_time ON analytics_events(event_time DESC);
CREATE INDEX idx_analytics_name_time ON analytics_events(event_name, event_time DESC);
```

## 6. 身份与实验分流设计

## 6.1 匿名用户标识（无登录前提）
1. 前端首次访问生成 `anon_id`（UUID），存于 `localStorage` + `cookie`。
2. 每次请求带 `x-anon-id` 请求头。
3. 后端 `lib/billing/identity.ts` 按 `anon_id` 做 `users` 表 upsert。

### 6.2 A/B 分流策略
1. 使用 `hash(anon_id + BILLING_EXPERIMENT_ID) % 100` 固定分组。
2. `< 50` 为 A 组，`>= 50` 为 B 组。
3. 同一用户必须稳定分组，不随会话变化。

## 7. 接口契约（V1）

## 7.1 统一响应结构（新增）
成功：
```json
{
  "success": true,
  "data": {},
  "requestId": "req_xxx"
}
```

失败：
```json
{
  "success": false,
  "error": {
    "code": "PAYWALL_REQUIRED",
    "message": "今日免费次数已用完",
    "details": {
      "variant": "A",
      "plans": [
        { "type": "day", "priceCents": 290 },
        { "type": "month", "priceCents": 1990 }
      ]
    }
  },
  "requestId": "req_xxx"
}
```

### 7.2 `GET /api/billing/entitlement`
用途：读取当前权益、实验组、剩余免费次数。

返回 `data` 示例：
```json
{
  "variant": "A",
  "activePlan": "free",
  "freeDailyLimit": 1,
  "freeRemaining": 1,
  "currentEntitlement": null,
  "prices": {
    "day": 290,
    "month": 1990
  }
}
```

### 7.3 `POST /api/billing/order`
用途：创建订单并返回支付参数。

请求：
```json
{
  "planType": "day",
  "clientRequestId": "2f5a8ef7-5c24-4e95-8f1b-f0d3cc1f9c1a"
}
```

返回：
```json
{
  "success": true,
  "data": {
    "orderNo": "UM20260228123456",
    "amountCents": 290,
    "payChannel": "mock",
    "paymentPayload": {
      "mockToken": "pay_xxx"
    }
  }
}
```

### 7.4 `POST /api/billing/webhook`
用途：支付回调落单、幂等处理、权益发放。

关键逻辑：
1. 先写 `payment_webhook_logs`（唯一键防重复）。
2. 更新 `orders.status` 到 `paid`。
3. 调用 `grantEntitlement(order)`。
4. 成功后 `orders.status=fulfilled`。

### 7.5 `POST /api/billing/refresh`
用途：用户点击“我已支付，刷新状态”。

请求：
```json
{
  "orderNo": "UM20260228123456"
}
```

返回：
```json
{
  "success": true,
  "data": {
    "orderStatus": "fulfilled",
    "activePlan": "day"
  }
}
```

## 8. `/api/parse` 的核心改造

## 8.1 前置流程（新增）
在 `app/api/parse/route.ts` 入口最前面插入：
1. 识别用户（`resolveUserFromRequest`）。
2. 检查是否有 active entitlement（`month > day`）。
3. 若无权益，检查 `usage_daily.success_count < 1`。
4. 不满足则返回 `402 + PAYWALL_REQUIRED`。
5. 满足则继续执行原解析逻辑。
6. 解析成功后再扣次（避免失败请求扣免费次数）。

### 8.2 新错误码建议
1. `PAYWALL_REQUIRED`
2. `ORDER_NOT_FOUND`
3. `ORDER_NOT_PAYABLE`
4. `ORDER_ALREADY_FULFILLED`
5. `FAIR_USE_SOFT_LIMITED`
6. `WEBHOOK_SIGNATURE_INVALID`

### 8.3 兼容性要求
1. 保留现有 `success/data` 结构。
2. 错误统一补齐 `error.code`，避免前端只能读 message。
3. 历史前端逻辑若只读 `error` 字符串，应继续可用。

## 9. 前端接入改造

## 9.1 `stores/billingStore.ts`（新增）
状态建议：
1. `isPaywallOpen`
2. `entitlement`
3. `variant`
4. `prices`
5. `createOrder` / `refreshEntitlement`

### 9.2 `stores/parseStore.ts`（修改）
1. `parseUrl` 捕获 `PAYWALL_REQUIRED` 时不展示错误 toast。
2. 改为打开 `PaywallModal` 并展示当前分组价格。
3. 其他错误保持现有 toast 行为。

### 9.3 UI 入口（修改）
1. `components/ParseInput.tsx` 显示“今日免费剩余 X 次”。
2. `app/(main)/page.tsx` 挂载全局 `PaywallModal`。
3. 支付成功后自动重试上次解析请求（可选但推荐）。

## 10. 支付状态机与补偿任务

## 10.1 状态流转
`created -> paying -> paid -> fulfilled`

异常分支：
1. `created/paying -> failed`
2. `paid/fulfilled -> refunded`

### 10.2 补偿任务（`scripts/billing-reconcile.ts`）
每 5 分钟扫描：
1. `orders.status='paid' AND fulfilled_at IS NULL` 的订单。
2. 重试 `grantEntitlement`（最多 N 次）。
3. 记录失败原因，超过阈值告警。

## 11. Docker 与部署改造

## 11.1 `docker-compose.yml` 最小增量
新增：
1. `postgres` 服务（持久化 volume）。
2. `frontend` 注入 `DATABASE_URL`。

示例：
```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_USER: unmark
    POSTGRES_PASSWORD: unmark
    POSTGRES_DB: unmark
  ports:
    - "5432:5432"
  volumes:
    - unmark_pg_data:/var/lib/postgresql/data

volumes:
  unmark_pg_data:
```

## 12. 测试清单（必须）

## 12.1 单元测试
1. `pricing.ts`：A/B 价格计算正确。
2. `quota.ts`：免费扣次与软上限逻辑正确。
3. `order.ts`：幂等创建（同 `clientRequestId` 返回同订单）。

### 12.2 API 集成测试
1. 免费次数用尽后 `/api/parse` 返回 `402/PAYWALL_REQUIRED`。
2. 支付回调重复推送只发放一次权益。
3. 日卡到期后自动降级为免费用户。

### 12.3 回归测试
1. 原有解析流程（抖音/小红书/快手）不受影响。
2. 非付费错误（解析失败）仍能正确提示。
3. 前端在不开通付费时仍可每日免费 1 次。

## 13. 4 周执行计划（工程版）

1. 第 1 周：DB + schema + identity + entitlement 查询 + `/api/billing/entitlement`。
2. 第 2 周：`/api/billing/order` + webhook + 幂等 + 补偿脚本。
3. 第 3 周：`/api/parse` 扣次接入 + PaywallModal + 价格页文案接入。
4. 第 4 周：埋点 + A/B 看板 + 灰度开关 + 回滚预案演练。

## 14. 上线验收标准（Go/No-Go）

满足以下条件才允许全量：
1. `PAYWALL_REQUIRED` 返回准确率 > 99.9%（抽样核对）。
2. webhook 重复回调不会重复发权益（幂等验证通过）。
3. 免费用户每日可稳定使用 1 次（跨时区边界验证通过）。
4. A/B 分组稳定，不会跨天漂移。
5. 解析主链路 P95 延迟增幅 < 15%。

## 15. 风险与优先处理

1. 无登录体系下多账号薅免费：优先加设备指纹哈希和基础风控规则。
2. 小额支付手续费占比高：V1 用日卡拉新，尽快推月卡承接。
3. 订单异常导致“支付成功但不可用”：优先保证补偿任务和手动刷新接口。
4. 现有错误响应不统一：先统一错误码，再接前端弹窗逻辑。

## 16. 开发起步命令（建议）

```bash
# 1) 安装依赖
npm i drizzle-orm postgres zod nanoid
npm i -D drizzle-kit tsx

# 2) 初始化 DB schema（按你的 Drizzle 配置）
npx drizzle-kit generate
npx drizzle-kit push

# 3) 本地启动
docker compose up -d postgres
npm run dev
```

---

如果要继续推进下一步，建议直接进入“V1 代码骨架提交”：
1. 先做 `lib/db` + `lib/billing/config/pricing/identity`。
2. 再接 `/api/billing/entitlement` 与 `/api/parse` 免费扣次。
3. 最后加订单与回调链路。

