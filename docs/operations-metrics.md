# Unmark 运营指标与埋点口径（MVP）

> 版本：v1
>
> 生效日期：2026-03-02
>
> 适用环境：Production（主域名 `unmark.ricardoiyu.top`）

## 1. 指标目标

本阶段先聚焦 5 个核心指标，用于回答两类问题：
1. 有多少人访问（流量）
2. 有多少人真正完成了解析（使用）

## 2. 核心运营指标定义

| 指标 | 含义 | 计算口径 | 目标值（初始） | 数据来源 |
| --- | --- | --- | --- | --- |
| UV | 每日独立访问用户数 | Vercel Web Analytics 的 Visitors | 持续增长 | Web Analytics |
| Parse Submit | 解析提交次数 | `parse_submit` 事件计数 | 与 UV 同向增长 | Custom Events |
| Parse Success Rate | 解析成功率 | `parse_success / parse_submit * 100%` | >= 95% | Custom Events |
| Parse P95 Latency | 解析 P95 耗时 | `parse_success.duration_ms` 的 P95 | <= 3000ms | Custom Events |
| Top Fail Reasons | 失败原因 Top5 | `parse_fail` 按 `fail_reason` 分组计数 | `unknown` 占比持续下降 | Custom Events |

## 3. 埋点事件定义

### 3.1 parse_submit

触发时机：用户点击“立即解析”并通过前端基础校验后。

字段：
- `platform`: `douyin | tiktok | kuaishou | xiaohongshu | bilibili | unknown`

### 3.2 parse_success

触发时机：`/api/parse` 返回成功且包含结果数据。

字段：
- `platform`: 平台标识
- `result_type`: `video | images`
- `mode`: `no-cookie | backend | unknown`
- `duration_ms`: 提交到成功返回的端到端耗时（毫秒）
- `status_code`: HTTP 状态码（通常为 `200`）

### 3.3 parse_fail

触发时机：`/api/parse` 请求失败，或业务返回失败。

字段：
- `platform`: 平台标识
- `fail_reason`: 失败原因枚举（见下一节）
- `duration_ms`: 提交到失败返回的端到端耗时（毫秒）
- `status_code`: HTTP 状态码（网络异常时为 `null`）

## 4. 失败原因枚举（fail_reason）

- `invalid_input`: 输入为空、格式无效、平台不支持
- `parse_rejected`: 可访问但无法提取内容（422 类）
- `upstream_unavailable`: 上游服务不可用（503、fetch failed 等）
- `timeout`: 请求超时
- `unknown`: 其他未分类错误

## 5. 看板使用说明（Vercel）

建议固定筛选条件：
- Environment: `Production`
- Domain: `unmark.ricardoiyu.top`
- Time range: `Last 24h` / `Last 7d`

建议固定图表：
1. Visitors 趋势（UV）
2. `parse_submit` 与 `parse_success` 趋势对比
3. Success Rate（按公式计算）
4. `duration_ms` 的 P95 趋势
5. `parse_fail` 按 `fail_reason` 的分布

## 6. 数据治理约束

- 不上报 URL、用户输入文本、Cookie、账号等敏感信息
- 不直接上报原始报错文本，统一归类为 `fail_reason`
- 新增埋点字段前，先评估是否会引入高基数和隐私风险
