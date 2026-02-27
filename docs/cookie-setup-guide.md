# 如何获取抖音 Cookie

**目标**: 获取有效的抖音 Cookie 用于解析服务

## 方法

### 步骤 1: 打开抖音网页版

1. 打开浏览器（Chrome 或 Edge）
2. 访问: https://www.douyin.com
3. **登录你的抖音账号**（重要：必须登录）

### 步骤 2: 打开开发者工具

1. 按 **F12** 键（或右键 → 检查）
2. 切换到 **Network（网络）** 标签
3. 刷新页面（F5）

### 步骤 3: 找到 Cookie

1. 在 Network 标签中，点击任意请求
2. 在右侧选择 **Headers（标头）**
3. 向下滚动找到 **Request Headers**
4. 找到 **Cookie** 字段

### 步骤 4: 复制 Cookie

复制整个 Cookie 值，格式类似：
```
__ac_nonce=06629f03b00; __ac_signature=_02B4Z6wo00f01...; s_v_web_id=verify_xxx...; ttwid=1%7Cxxx...; IsDouyinActive=true; ...
```

**提示**: Cookie 很长，确保完整复制。

### 步骤 5: 验证 Cookie 有效性

Cookie 应该包含以下关键字段：
- `ttwid`
- `s_v_web_id`
- `passport_csrf_token` 或 `__ac_signature`

---

## 配置到项目

获取 Cookie 后，告诉我 Cookie 内容，我会帮你配置到 Docker 容器中。

**注意**: Cookie 包含敏感信息，请勿分享给他人。
