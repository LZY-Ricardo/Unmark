# Billing 单人开发分支与发布流程（Unmark）

更新时间：2026-02-28  
适用场景：项目由个人开发与发布。

## 1. 分支模型（精简版）

1. 稳定分支：`main`
2. 付费功能分支：`feature/billing-v1`

原则：
1. 日常开发都在 `feature/billing-v1`。
2. `main` 只保留稳定可运行版本。
3. 付费功能未验证前，不合并到 `main`。

## 2. 功能开关（必须）

1. `BILLING_ENABLED=false`
2. `BILLING_EXPERIMENT_ENABLED=false`
3. `BILLING_WEBHOOK_ENABLED=false`
4. `BILLING_FAIR_USE_ENABLED=true`

原则：
1. 即使合并到 `main`，也先保持关闭。
2. 出问题优先关开关，不先改代码。

## 3. 单人开发工作流

1. 从 `main` 创建分支：`feature/billing-v1`。
2. 在分支完成付费功能开发与自测。
3. 合并前在 `main` 打回滚标签。
4. 合并分支到 `main`。
5. 合并后先不开开关，先验证基础功能。
6. 再按小流量灰度开开关。

## 4. 合并前自检清单

1. `/api/parse` 免费 1 次逻辑正确。
2. 免费耗尽后返回 `PAYWALL_REQUIRED`。
3. 下单幂等正常（同 `client_request_id` 不重复下单）。
4. webhook 幂等正常（同 `transaction_id` 不重复发权益）。
5. 支付成功后权益可读、可生效。
6. 付费开关关闭时，旧功能完全不受影响。
7. 关键日志可追踪（订单号、用户、状态）。

## 5. 灰度发布（个人版）

1. 第一步：发版到生产，但保持 `BILLING_ENABLED=false`。
2. 第二步：开 1% 流量（或仅你自己账号）。
3. 第三步：观察 30-60 分钟，确认无异常再扩到 10%、30%、100%。

重点观察：
1. 支付成功率
2. 权益发放成功率
3. 解析主链路延迟
4. 错误率与退款量

## 6. 回滚策略（按优先级）

1. 秒级回滚：`BILLING_ENABLED=false`
2. 分钟级回滚：`BILLING_WEBHOOK_ENABLED=false`
3. 版本回滚：回退到合并前标签版本

数据原则：
1. 不删除已支付订单
2. 不删除已发放权益
3. 只做状态修复与补偿

## 7. 推荐 Git 命令

```bash
# 1) 创建付费功能分支
git checkout main
git pull
git checkout -b feature/billing-v1

# 2) 开发完成后，查看状态
git status

# 3) 切回 main，打回滚标签
git checkout main
git tag pre-billing-v1

# 4) 合并付费分支（保留合并记录）
git merge --no-ff feature/billing-v1

# 5) 推送分支与标签
git push origin main
git push origin pre-billing-v1
```

## 8. 本项目当前状态

1. 付费分支已创建：`feature/billing-v1`
2. 当前建议：先在该分支完成 `API + DB + Paywall` 最小闭环，再考虑合并。

