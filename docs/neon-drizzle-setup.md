# Neon + Drizzle 快速接入（Unmark）

更新时间：2026-03-01

## 1. 在 Neon 创建项目

1. 新建一个 Neon Project。
2. 选择离你服务端最近的 Region。
3. 创建数据库（默认库名可用 `neondb`）。

## 2. 获取连接串

在 Neon 控制台获取两类连接串：

1. `DATABASE_URL`：使用 `-pooler` 地址（业务请求）
2. `DIRECT_URL`：使用 direct 地址（migration / drizzle push）

示例：

```env
DATABASE_URL=postgresql://xxx:xxx@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://xxx:xxx@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

## 3. 配置项目环境变量

在本地 `.env.local` 增加：

```env
DATABASE_URL=...
DIRECT_URL=...
PARSE_UPSTREAM_TIMEOUT_MS=8000

BILLING_ENABLED=true
BILLING_EXPERIMENT_ENABLED=true
BILLING_WEBHOOK_ENABLED=false
BILLING_FAIR_USE_ENABLED=true

BILLING_FREE_DAILY_LIMIT=1
BILLING_DAY_PRICE_A=290
BILLING_MONTH_PRICE_A=1990
BILLING_DAY_PRICE_B=390
BILLING_MONTH_PRICE_B=2490
BILLING_EXPERIMENT_ID=pricing_v1
BILLING_FAIR_USE_DAILY_SOFT_CAP=80
```

## 4. 初始化表结构

当前仓库已经包含：

1. Drizzle schema：`lib/db/schema.ts`
2. Drizzle 配置：`drizzle.config.ts`
3. 初始 SQL：`drizzle/0000_billing_init.sql`

执行：

```bash
npm run db:push
```

如果你想走 migration 生成流程：

```bash
npm run db:generate
```

## 5. 验证

1. 启动项目：`npm run dev`
2. 调用 `GET /api/billing/entitlement`，确认能返回 `billingEnabled` 与 `prices`
3. 用 `POST /api/billing/order` 下单，确认订单与权益可落库

## 6. 回退策略

如果 Neon 临时不可用：

1. 去掉 `DATABASE_URL`（代码会自动回退到内存存储）
2. 或将 `BILLING_ENABLED=false` 关闭计费链路
