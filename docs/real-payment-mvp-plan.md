# Unmark 真实支付接入方案（MVP）
更新时间：2026-03-01
适用分支：`feature/billing-v1`

## 1. 目标与边界

目标：在现有计费闭环（免费次数、下单、权益发放、付费墙）基础上，替换 `mock` 支付，接入真实支付并保证可灰度、可回滚。

MVP 边界：
1. 支持 `day` 与 `month` 两种付费方案。
2. 优先接入一个真实通道上线（推荐先支付宝），稳定后再接微信。
3. 仅支持支付成功发放权益；退款自动回收可放到 V1.1。

不在本阶段：
1. 优惠券、拼团、邀请返利。
2. 多币种结算。
3. 完整财务对账后台。

## 2. 为什么先支付宝再微信

单人开发下，为降低风险，建议分两步：
1. 第一步：支付宝网页支付（回跳 + 异步通知），最快打通真实收款。
2. 第二步：微信支付（H5/Native/JSAPI 任选其一），复用同一订单与回调框架。

这样可以先验证真实资金链路，再扩展第二通道。

## 3. 现有代码可复用部分

已可直接复用：
1. 订单接口：`POST /api/billing/order`
2. 刷新接口：`POST /api/billing/refresh`
3. Webhook 接口：`POST /api/billing/webhook`
4. 订单状态机与权益发放：`lib/billing/order.ts`
5. 幂等基础：`clientRequestId`、`billing_webhook_events`

当前缺口：
1. `payChannel` 仅有 `mock`。
2. 下单返回的是 `mockToken`，没有真实支付参数。
3. webhook 验签是简化版共享密钥，不是通道官方签名验签。

## 4. 最小架构设计

新增统一支付网关层：

```text
lib/billing/payments/
  types.ts
  gateway.ts
  providers/
    mock.ts
    alipay.ts
    wechat.ts
```

核心接口（建议）：
1. `createPayment(order) -> providerOrderNo + paymentPayload`
2. `verifyAndParseWebhook(request) -> { orderNo, transactionId, paidAmount, status, raw }`
3. `queryPayment(order) -> providerStatus`

路由职责：
1. `/api/billing/order`：创建内部订单 + 调用 `createPayment` + 返回前端支付参数。
2. `/api/billing/webhook/[provider]`：验签、幂等、状态推进、发放权益。
3. `/api/billing/refresh`：查询内部状态；可选触发 `queryPayment` 兜底。

## 5. 数据库改造（MVP 必需）

在现有 `billing_orders` / `billing_webhook_events` 基础上最小增量：

1. `billing_pay_channel` 枚举增加：`alipay`、`wechat`。
2. `billing_orders` 增加字段：
`provider_order_no`：第三方侧订单号（用于对账）
`provider_trade_no`：第三方交易号（支付成功后）
`notify_payload`：最近一次回调原文（JSON）
3. `billing_webhook_events` 增加字段：
`provider`
`signature_valid`
`payload`（JSON）

建议唯一约束：
1. `provider + provider_trade_no` 唯一（防重复入账）。
2. `provider + event_key` 唯一（防重复回调）。

## 6. 订单状态机（保持简单）

状态流转：
1. `created -> paying`（拿到支付参数）
2. `paying -> paid`（回调验签通过且金额校验通过）
3. `paid -> fulfilled`（权益发放完成）
4. `paying -> failed`（超时关闭/明确失败）
5. `fulfilled -> refunded`（V1.1）

关键原则：
1. 发放权益只在 `paid -> fulfilled` 做一次，必须幂等。
2. 任意重复回调都不应重复发权益。

## 7. 接口改造清单

## 7.1 `POST /api/billing/order`

请求新增：
1. `payChannel`: `alipay | wechat`
2. `payScene`: `h5 | web | qr`（按前端场景）

返回新增：
1. `paymentPayload`（真实参数）
2. `providerOrderNo`
3. `expiresAt`

校验规则：
1. `amountCents` 必须由服务端按 plan 计算，前端不得传金额。
2. 同一 `clientRequestId` 必须幂等返回同一订单。

## 7.2 `POST /api/billing/webhook/[provider]`

处理顺序：
1. 验签
2. 查单并锁单（建议事务 + `FOR UPDATE`）
3. 金额/币种/商户号校验
4. 状态推进与权益发放
5. 记录 webhook 事件与原文
6. 返回通道要求的成功响应

## 7.3 `POST /api/billing/refresh`

逻辑：
1. 先读本地订单状态。
2. 若仍是 `paying` 且超过轮询间隔，可调用支付通道查单兜底。
3. 返回前端可展示状态：`paying | fulfilled | failed`。

## 8. 前端改造点

文件：
1. `components/billing/PaywallModal.tsx`
2. `stores/billingStore.ts`

改造：
1. 购买按钮触发时传 `payChannel`。
2. 收到 `paymentPayload` 后按通道拉起支付：
支付宝：跳转支付页或拉起 SDK
微信：H5 跳转或二维码展示
3. 支付后进入轮询 `refresh`（例如每 2 秒，最多 60 秒）。
4. 成功后刷新 entitlement 并关闭弹窗。

## 9. 安全与风控最低要求

1. 必做官方签名验签，禁止仅用共享密钥替代。
2. webhook 仅允许 `POST`，并限制来源 IP（如通道提供）。
3. 校验金额、商户号、订单号三要素一致。
4. 所有支付日志脱敏（不记录完整身份证、手机号、卡号等）。
5. 增加超时与重试上限，避免接口卡死。

## 10. 环境变量清单（建议）

通用：
1. `PAY_PROVIDER_DEFAULT=alipay`
2. `PAY_NOTIFY_BASE_URL=https://your-domain.com`

支付宝（示例命名）：
1. `ALIPAY_APP_ID=...`
2. `ALIPAY_PRIVATE_KEY=...`
3. `ALIPAY_PUBLIC_KEY=...`
4. `ALIPAY_NOTIFY_PATH=/api/billing/webhook/alipay`
5. `ALIPAY_RETURN_URL=https://your-domain.com/payment/return`

微信（示例命名）：
1. `WECHAT_MCH_ID=...`
2. `WECHAT_APP_ID=...`
3. `WECHAT_API_V3_KEY=...`
4. `WECHAT_PRIVATE_KEY=...`
5. `WECHAT_SERIAL_NO=...`
6. `WECHAT_NOTIFY_PATH=/api/billing/webhook/wechat`

## 11. 实施步骤（单人可执行）

第 1 步：模型与迁移
1. 扩展 enum 与订单/webhook 表字段。
2. 生成并执行 Drizzle 迁移。

第 2 步：支付网关抽象
1. 新增 `payments/gateway.ts` 与 `providers/mock.ts`。
2. 保持现有逻辑不变，仅通过网关调用 mock，先保证无回归。

第 3 步：接入支付宝
1. 实现 `providers/alipay.ts` 的下单、验签、查单。
2. 改造 `/order` 与 `/webhook/alipay`。
3. 端到端联调：下单 -> 支付 -> 回调 -> 发权益。

第 4 步：灰度发布
1. 仅对你自己的 `anon_id` 或测试名单开启真实支付。
2. 观察 1-2 天，再扩大流量。

第 5 步：接入微信（复用框架）
1. 按同样接口实现 `providers/wechat.ts`。
2. 保持 webhook 与状态推进路径一致。

## 12. 验收清单（上线前）

1. 同一订单重复回调不重复发权益。
2. 错误签名回调被拒绝且有日志。
3. 金额不一致时拒绝入账。
4. 支付成功后 60 秒内 entitlement 可见。
5. 关闭开关后可立即回退到仅免费模式。

## 13. 回滚策略

1. 秒级回滚：`BILLING_WEBHOOK_ENABLED=false` 与真实支付开关关闭。
2. 保留订单和回调数据，不做删库回滚。
3. 如需停机修复，仅冻结新下单，已支付订单继续补发权益。

## 14. 你下一步可以直接做什么

1. 先只实现支付宝通道并联调成功。
2. 我再基于这份文档给你输出“第一批具体代码改动（按文件逐条）”并直接落地到分支。
