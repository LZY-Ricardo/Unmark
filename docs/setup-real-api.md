# 🎯 配置真实解析服务 - 完整指南

## 📋 配置步骤

### 第 1 步：获取抖音 Cookie

#### 1.1 打开抖音网页版
- 浏览器访问：https://www.douyin.com
- **登录你的抖音账号**（必须！）
- 等待页面完全加载

#### 1.2 打开开发者工具
- 按 **F12** 键
- 切换到 **Network（网络）** 标签
- 刷新页面（F5）

#### 1.3 找到并复制 Cookie
1. 在 Network 标签中，点击任意请求
2. 右侧选择 **Headers（标头）**
3. 向下滚动找到 **Request Headers**
4. 找到 **Cookie** 字段
5. 点击 Cookie 值旁边的 **复制** 按钮

✅ Cookie 应该包含这些关键字段：
- `ttwid`
- `s_v_web_id`
- `passport_csrf_token` 或 `__ac_signature`

---

### 第 2 步：更新配置文件

#### 方法 A：使用文本编辑器（推荐）

1. **打开项目目录**：
   ```
   f:\myProjects\Unmark\
   ```

2. **用记事本或 VSCode 打开** `config.yaml`

3. **找到第 10 行**：
   ```yaml
   Cookie: PASTE_YOUR_COOKIE_HERE
   ```

4. **替换为你的 Cookie**：
   ```yaml
   Cookie: __ac_nonce=06629f03b00; ttwid=1%7Cxxx...; s_v_web_id=verify_xxx...; ...
   ```

5. **保存文件**（Ctrl+S）

---

#### 方法 B：快速替换命令

在项目目录下运行：

```bash
# 将 YOUR_COOKIE 替换为你复制的 Cookie 内容
# Windows PowerShell
(Get-Content config.yaml) -replace 'PASTE_YOUR_COOKIE_HERE', 'YOUR_COOKIE' | Set-Content config.yaml
```

---

### 第 3 步：重启 Docker 容器

#### 打开 PowerShell 或命令提示符，进入项目目录：

```bash
cd f:\myProjects\Unmark
```

#### 重启容器：

```bash
# 停止容器
docker compose down

# 启动容器（会加载新的配置）
docker compose up -d douyin-api
```

---

### 第 4 步：验证配置

#### 4.1 检查容器状态

```bash
docker ps
```

应该看到 `unmark-douyin-api-1` 正在运行。

#### 4.2 测试解析

访问：http://localhost:3000

输入任意抖音链接进行测试。

---

## ⚠️ 常见问题

### Q1: 还是显示解析失败？

**可能原因**：
- Cookie 已过期（通常 7-30 天）
- Cookie 不完整
- 账号被风控

**解决方案**：
1. 重新获取 Cookie
2. 使用不同的账号
3. 尝试刷新抖音页面后再获取 Cookie

---

### Q2: 配置文件中的 Cookie 格式不对？

**正确格式**：
```yaml
Cookie: __ac_nonce=xxx; ttwid=xxx; s_v_web_id=xxx; ...
```

**注意**：
- 保持一行
- 不要添加额外的引号
- 确保完整复制

---

### Q3: 如何验证 Cookie 有效？

在浏览器中测试：

1. 打开 https://www.douyin.com
2. 按 F12 → Console
3. 输入：
   ```javascript
   document.cookie
   ```
4. 确认能看到 `ttwid` 等字段

---

## 🎉 配置完成后的效果

- ✅ 真实抖音链接解析
- ✅ 无水印视频下载
- ✅ 无水印图集下载
- ✅ 完整的作者信息
- ✅ 高清画质

---

## 📞 需要帮助？

如果按照步骤操作后仍有问题，请提供：
1. 你使用的浏览器
2. 错误提示截图
3. 测试的链接

---

**下一步**：配置完成后，访问 http://localhost:3000 测试真实解析功能！
