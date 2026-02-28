# Unmark 付费策略方案（V1）

更新时间：2026-02-28  
状态：Draft（可直接进入开发排期）

## 1. 目标与原则

### 1.1 目标
1. 在不影响拉新的前提下，验证用户真实付费意愿。
2. 用低门槛日卡实现首单转化，用月卡提升收入稳定性。
3. 控制重度用户成本，确保整体毛利为正。

### 1.2 核心原则
1. 免费版可体验但不可长期白嫖。
2. 价格结构必须“直觉可理解”，避免复杂梯度。
3. 所有价格结论以 A/B 数据为准，不靠主观判断。

## 2. 套餐与定价（首发）

## 2.1 A/B 定价实验

| 实验组 | 日卡 | 月卡 | 免费额度 |
|---|---:|---:|---|
| A 组 | 2.9 元 / 24小时 | 19.9 元 / 30天 | 每日 1 次 |
| B 组 | 3.9 元 / 24小时 | 24.9 元 / 30天 | 每日 1 次 |

建议：先跑 14 天，按统一口径比较收入与转化。

### 2.2 套餐权益

| 套餐 | 次数 | 速度 | 队列 | 其他 |
|---|---|---|---|---|
| Free | 每日 1 次 | 基础 | 普通队列 | 次日重置 |
| Day Pass | 24 小时内高频 | 正常 | 普通队列 | 软上限后降速 |
| Month Pass | 30 天内高频 | 较快 | 优先队列 | 软上限后降速 |

### 2.3 公平使用（软上限）
1. 建议阈值：60~80 次/天（可配置）。
2. 超过阈值不封禁，改为降速或排队。
3. 极端异常账号进入风控慢队列（并发限制 + 人工审查）。

## 3. 关键业务规则

### 3.1 免费次数规则
1. 免费额度按用户本地时区 00:00 重置。
2. 免费次数仅针对完整请求成功扣减。
3. 失败请求（服务端错误、支付中断）不扣免费次数。

### 3.2 权益优先级
1. `Month Pass` 生效时，直接按月卡权益。
2. 若无月卡但有 `Day Pass`，按日卡权益。
3. 若都没有，按 `Free` 权益并检查当日剩余次数。

### 3.3 日卡有效期
1. 自支付成功时间起 24 小时。
2. 重复购买日卡按“顺延”处理，避免权益覆盖损失。
3. 若用户已是月卡用户，购买日卡默认拦截（避免误购）。

### 3.4 月卡升级策略
1. 用户在 30 天内第 3 次购买日卡时触发升级提示。
2. 可发放一次性升级券（如 5 折，24 小时有效）。
3. 支持“按剩余价值折算”升级（后续版本）。

## 4. 用户流程设计

### 4.1 主流程
1. 用户发起请求。
2. 系统判断权益（Month > Day > Free）。
3. 免费次数不足时展示付费弹窗。
4. 用户选择日卡或月卡并完成支付。
5. 回调成功后发放权益，页面可立即继续使用。

### 4.2 关键触发点
1. `quota_exhausted`：每日免费次数耗尽。
2. `third_daypass_trigger`：30 天内第 3 次买日卡。
3. `high_frequency_detected`：触发公平使用降速策略。

## 5. 支付与订单状态机

### 5.1 订单状态
1. `created`：已创建订单，待支付。
2. `paying`：支付渠道处理中。
3. `paid`：支付成功，待发放权益。
4. `fulfilled`：权益已发放。
5. `failed`：支付失败或超时。
6. `refunded`：退款成功。

### 5.2 回调要求
1. 必须幂等：同一 `transaction_id` 多次回调只处理一次。
2. 状态机不可逆（`fulfilled` 不回退为 `paid`）。
3. 回调失败自动重试（指数退避，最多 N 次）。

### 5.3 容错建议
1. `paid` 但未 `fulfilled`：补偿任务扫描并自动补发。
2. 发放成功但前端未刷新：客户端支持主动拉取权益状态。
3. 支付渠道延迟：订单页提供“我已完成支付，刷新状态”。

## 6. 风控与成本控制

### 6.1 风控策略
1. 账号绑定（手机号/邮箱）+ 设备指纹。
2. 同设备多账号短时高频切换时触发风控。
3. IP 异常并发、脚本化请求进入验证码或慢队列。

### 6.2 成本控制
1. 对重计算任务做分级队列（月卡优先但仍有限流）。
2. 对大资源消耗请求可设置单次上限。
3. 周级监控“单用户毛利”，高负毛利用户触发策略。

## 7. 页面与弹窗文案（可直接上线）

### 7.1 价格页（A 组示例）
1. 标题：今天先免费 1 次，好用再付费
2. 副标题：轻度用户按天买，常用用户直接月卡更省
3. 免费卡片：
   - 每日 1 次免费
   - 基础速度
   - 按钮：先免费试用
4. 日卡卡片：
   - ¥2.9 / 24小时
   - 当日可高频使用
   - 适合临时高频需求
   - 按钮：开通日卡
5. 月卡卡片（推荐）：
   - ¥19.9 / 30天
   - 不限次 + 优先队列
   - 买 7 次日卡≈月卡价
   - 按钮：开通月卡（更划算）
6. 页脚说明：公平使用规则：超高频会降速以保障服务稳定

### 7.2 价格页（B 组替换项）
1. 日卡：¥3.9 / 24小时
2. 月卡：¥24.9 / 30天
3. 对比文案：买 7 次日卡 > 月卡价

### 7.3 付费弹窗文案
1. 免费耗尽弹窗
   - 标题：今日免费次数已用完
   - 正文：开通日卡，今天继续使用；常用建议月卡更省
   - 主按钮：¥2.9 开通日卡（B 组显示 ¥3.9）
   - 次按钮：¥19.9 开通月卡（B 组显示 ¥24.9）
   - 文字链接：明天再来（再送 1 次免费）
2. 第 3 次日卡升级弹窗
   - 标题：你本月已购买 3 次日卡
   - 正文：升级月卡预计更省钱，且可优先处理
   - 主按钮：升级月卡
   - 次按钮：继续买日卡
3. 支付成功提示
   - 标题：开通成功
   - 正文：权益已生效，可立即继续使用
   - 按钮：继续使用

## 8. 埋点方案（A/B 实验最小集）

### 8.1 事件清单
1. `exp_assigned`：实验分组完成。
2. `quota_exhausted`：免费额度耗尽。
3. `paywall_view`：看到付费弹窗或价格页。
4. `paywall_cta_click`：点击日卡/月卡 CTA。
5. `checkout_open`：拉起支付收银台。
6. `order_paid`（服务端）：支付成功。
7. `entitlement_granted`（服务端）：权益发放成功。
8. `plan_upgrade_prompt_view`：第 3 次日卡升级提示曝光。
9. `plan_upgrade_paid`：从日卡转月卡成功。
10. `refund_success`（服务端）：退款成功。

### 8.2 事件公共字段
1. `event_name`
2. `event_time`（ISO8601）
3. `user_id`
4. `session_id`
5. `variant`（A/B）
6. `platform`（web/app）
7. `app_version`

### 8.3 核心事件属性建议
1. `paywall_cta_click`
   - `plan_type`：`day` / `month`
   - `price`
   - `entry_point`：`quota_exhausted` / `pricing_page`
2. `order_paid`
   - `order_id`
   - `amount`
   - `currency`
   - `payment_channel`
   - `plan_type`
3. `entitlement_granted`
   - `plan_type`
   - `start_at`
   - `end_at`
   - `grant_latency_ms`

### 8.4 JSON Schema（事件通用）
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "analytics_event",
  "type": "object",
  "required": [
    "event_name",
    "event_time",
    "user_id",
    "variant"
  ],
  "properties": {
    "event_name": { "type": "string" },
    "event_time": { "type": "string", "format": "date-time" },
    "user_id": { "type": "string" },
    "session_id": { "type": "string" },
    "variant": { "type": "string", "enum": ["A", "B"] },
    "platform": { "type": "string", "enum": ["web", "app"] },
    "app_version": { "type": "string" },
    "properties": { "type": "object", "additionalProperties": true }
  },
  "additionalProperties": false
}
```

## 9. 数据看板 SQL 模板（PostgreSQL）

### 9.1 7 日收入 / DAU（按实验组）
```sql
WITH dau AS (
  SELECT
    date_trunc('day', event_time) AS dt,
    variant,
    COUNT(DISTINCT user_id) AS dau
  FROM analytics_events
  WHERE event_name = 'app_open'
    AND event_time >= now() - interval '7 day'
  GROUP BY 1, 2
),
rev AS (
  SELECT
    date_trunc('day', paid_at) AS dt,
    variant,
    SUM(amount) AS revenue
  FROM orders
  WHERE status IN ('paid', 'fulfilled')
    AND paid_at >= now() - interval '7 day'
  GROUP BY 1, 2
)
SELECT
  d.dt::date AS date,
  d.variant,
  COALESCE(r.revenue, 0) AS revenue,
  d.dau,
  ROUND(COALESCE(r.revenue, 0) / NULLIF(d.dau, 0), 4) AS revenue_per_dau
FROM dau d
LEFT JOIN rev r ON d.dt = r.dt AND d.variant = r.variant
ORDER BY date, variant;
```

### 9.2 免费到付费转化率（按实验组）
```sql
WITH exposed AS (
  SELECT DISTINCT user_id, variant
  FROM analytics_events
  WHERE event_name = 'quota_exhausted'
    AND event_time >= now() - interval '14 day'
),
paid AS (
  SELECT DISTINCT user_id
  FROM orders
  WHERE status IN ('paid', 'fulfilled')
    AND paid_at >= now() - interval '14 day'
)
SELECT
  e.variant,
  COUNT(*) AS exhausted_users,
  COUNT(*) FILTER (WHERE p.user_id IS NOT NULL) AS paid_users,
  ROUND(
    COUNT(*) FILTER (WHERE p.user_id IS NOT NULL)::numeric
    / NULLIF(COUNT(*), 0),
    4
  ) AS conversion_rate
FROM exposed e
LEFT JOIN paid p ON e.user_id = p.user_id
GROUP BY e.variant
ORDER BY e.variant;
```

### 9.3 日卡 7 日复购率
```sql
WITH day_orders AS (
  SELECT user_id, paid_at::date AS pay_date
  FROM orders
  WHERE plan_type = 'day'
    AND status IN ('paid', 'fulfilled')
),
first_buy AS (
  SELECT user_id, MIN(pay_date) AS first_date
  FROM day_orders
  GROUP BY user_id
),
repurchase AS (
  SELECT f.user_id
  FROM first_buy f
  JOIN day_orders d
    ON d.user_id = f.user_id
   AND d.pay_date > f.first_date
   AND d.pay_date <= f.first_date + 7
  GROUP BY f.user_id
)
SELECT
  COUNT(*) AS first_buy_users,
  (SELECT COUNT(*) FROM repurchase) AS repurchase_users,
  ROUND(
    (SELECT COUNT(*) FROM repurchase)::numeric / NULLIF(COUNT(*), 0),
    4
  ) AS repurchase_rate_7d
FROM first_buy;
```

### 9.4 日卡转月卡率（30 天窗口）
```sql
WITH day_users AS (
  SELECT DISTINCT user_id
  FROM orders
  WHERE plan_type = 'day'
    AND status IN ('paid', 'fulfilled')
    AND paid_at >= now() - interval '30 day'
),
month_users AS (
  SELECT DISTINCT user_id
  FROM orders
  WHERE plan_type = 'month'
    AND status IN ('paid', 'fulfilled')
    AND paid_at >= now() - interval '30 day'
)
SELECT
  COUNT(*) AS day_users,
  COUNT(*) FILTER (WHERE m.user_id IS NOT NULL) AS day_to_month_users,
  ROUND(
    COUNT(*) FILTER (WHERE m.user_id IS NOT NULL)::numeric
    / NULLIF(COUNT(*), 0),
    4
  ) AS day_to_month_rate
FROM day_users d
LEFT JOIN month_users m ON d.user_id = m.user_id;
```

## 10. 技术实现建议（MVP）

### 10.1 最小数据表
1. `users`：用户基础信息与风控字段。
2. `plans`：套餐定义（day/month/free）。
3. `orders`：订单主表（金额、状态、渠道、实验组）。
4. `entitlements`：权益记录（生效、到期、状态）。
5. `usage_daily`：用户当日使用计数。
6. `analytics_events`：事件日志。

### 10.2 必要接口
1. `GET /api/billing/entitlement`：查询当前权益与剩余次数。
2. `POST /api/billing/order`：创建订单。
3. `POST /api/billing/webhook`：支付回调。
4. `POST /api/billing/refresh`：手动刷新支付状态。
5. `POST /api/usage/consume`：请求前扣次与资格校验。

### 10.3 关键幂等键
1. 订单创建：`client_request_id`。
2. 支付回调：`transaction_id`。
3. 权益发放：`order_id + entitlement_type`。

## 11. 上线节奏（4 周）

1. 第 1 周：套餐与额度系统、权益判定、软上限限流。
2. 第 2 周：支付下单、回调幂等、补偿任务。
3. 第 3 周：价格页、弹窗、升级提示、基础埋点。
4. 第 4 周：A/B 实验、看板联调、价格决策会。

## 12. 决策口径与回滚

### 12.1 实验决策
1. 主指标：7 日收入 / DAU。
2. 副指标：免费到付费转化、日卡复购、日卡转月卡、退款率。
3. 判定：若高价组收入提升不显著且转化明显下降，保留低价组。

### 12.2 回滚策略
1. 可配置开关一键回退到单价版本（例如统一 A 组）。
2. 实验组分配服务降级为固定分组。
3. 保留历史订单与权益，不回滚已购权益。

## 13. 待确认事项

1. 支付渠道与费率（微信/支付宝/Stripe）。
2. 用户时区策略（本地时区或统一北京时间）。
3. 是否启用“升级补差价”与“首月优惠”。
4. 是否需要团队版预埋（权限与协作字段）。

