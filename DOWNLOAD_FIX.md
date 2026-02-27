# 图片下载功能修复说明

## 🎯 问题描述

**原问题：** 点击单张图片的"保存"按钮会新开一个图片预览页面，而不是直接下载图片。

**根本原因：** 抖音图片存储在跨域服务器（`p3-pc-sign.douyinpic.com`），简单的 `link.download` 方法无法触发跨域资源的下载。

---

## ✅ 解决方案

### 1. **使用 Fetch + Blob 方式下载**

**修改文件：** [lib/utils.ts](lib/utils.ts#L35)

**核心逻辑：**
```typescript
export async function downloadFile(url: string, filename: string) {
  try {
    // 1. 使用 fetch 获取图片数据
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
    });

    // 2. 获取 blob 数据
    const blob = await response.blob();

    // 3. 创建 object URL
    const blobUrl = window.URL.createObjectURL(blob);

    // 4. 触发下载
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.click();

    // 5. 清理资源
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    // 降级方案：在新标签页打开
    window.open(url, '_blank');
  }
}
```

### 2. **智能文件名生成**

**新增功能：** `downloadImage` 函数

**特性：**
- ✅ 从URL自动提取文件扩展名（.jpg、.webp等）
- ✅ 使用视频标题作为文件名前缀
- ✅ 自动清理文件名中的非法字符
- ✅ 添加图片序号（1、2、3...）

**示例：**
```
输入：
  - URL: https://p3-pc-sign.douyinpic.com/tos-cn-i-0813c000-ce/xxx.webp?...
  - Title: "喜欢这样的世界 但世界不喜欢我。#上杉绘梨衣"
  - Index: 0

输出文件名：
  喜欢这样的世界 但世界不喜欢我。#上杉绘梨衣_1.webp
```

### 3. **下载状态反馈**

**修改文件：** [components/ImageGrid.tsx](components/ImageGrid.tsx)

**新增功能：**
- ✅ 单张下载显示"下载中..."状态
- ✅ 批量下载显示进度（如："下载中 (3/10)"）
- ✅ 下载中的按钮自动禁用，防止重复点击
- ✅ 每张图片间隔300ms，避免浏览器阻止多文件下载

---

## 🎉 使用效果

### 单张图片下载

**点击"保存"按钮后：**
1. 按钮显示"下载中..."
2. 图片自动下载到浏览器默认下载目录
3. 文件名格式：`标题_序号.扩展名`
4. 下载完成后按钮恢复为"保存"

### 批量下载

**点击"一键下载全部"后：**
1. 按钮显示下载进度："下载中 (1/10)"、"下载中 (2/10)"...
2. 按顺序依次下载所有图片
3. 每张图片间隔300ms
4. 全部完成后按钮恢复为"一键下载全部"

### 视频下载

**点击"下载视频"按钮后：**
1. 视频自动下载
2. 文件名格式：`视频标题.mp4`
3. 无水印版本

---

## 📋 测试验证

### 测试用例1：单张图片下载
1. 解析图集链接
2. 点击第1张图片的"保存"按钮
3. **预期结果：** 图片直接下载，不打开新页面

### 测试用例2：批量下载
1. 解析图集链接（10张图片）
2. 点击"一键下载全部"按钮
3. **预期结果：**
   - 显示进度："下载中 (1/10)" → "下载中 (2/10)"...
   - 10张图片全部下载
   - 文件名包含标题和序号

### 测试用例3：视频下载
1. 解析视频链接
2. 点击"下载视频"按钮
3. **预期结果：** 视频直接下载

---

## 🔧 技术细节

### CORS 跨域配置

抖音图片服务器支持 CORS，因此可以使用 `fetch` 直接获取图片数据：

```javascript
const response = await fetch(url, {
  mode: 'cors',           // 启用跨域请求
  credentials: 'omit',    // 不发送凭证
});
```

### Blob URL 生命周期

```javascript
// 1. 创建 Blob URL
const blobUrl = window.URL.createObjectURL(blob);

// 2. 使用 Blob URL 下载
link.href = blobUrl;

// 3. 释放内存（重要！）
window.URL.revokeObjectURL(blobUrl);
```

### 文件名清理

移除 Windows 文件系统不允许的字符：
```javascript
const cleanTitle = title.replace(/[<>:"/\\|?*]/g, '_');
```

---

## ⚠️ 注意事项

### 浏览器限制

**多文件下载限制：**
- 不同浏览器对批量下载的限制不同
- Chrome: 通常允许10个左右的自动下载
- Firefox: 相对宽松
- Safari: 可能会弹出多个确认对话框

**解决方案：**
- 每张图片间隔300ms
- 如果被阻止，用户可以手动允许下载

### 降级方案

如果 `fetch` 失败（网络问题或CORS限制），系统会自动降级：
```javascript
catch (error) {
  // 降级：在新标签页打开图片
  window.open(imageUrl, '_blank');
}
```

用户可以右键保存图片。

---

## 🚀 快速测试

**测试链接：**
```
https://v.douyin.com/4evJ3qVn5HA/
```

**测试步骤：**
1. 访问 http://localhost:3001
2. 粘贴链接并解析
3. 点击单张图片的"保存"按钮
4. 观察是否直接下载（而不是打开新页面）

---

## 📚 相关代码

**修改的文件：**
- [lib/utils.ts](lib/utils.ts) - 下载功能实现
- [components/ImageGrid.tsx](components/ImageGrid.tsx) - 图片组件更新
- [components/VideoCard.tsx](components/VideoCard.tsx) - 视频组件（已自动支持）

**新增函数：**
- `downloadFile(url, filename)` - 通用下载函数
- `downloadImage(url, title, index)` - 图片专用下载函数

---
**最后更新：** 2026-02-27
**状态：** ✅ 所有下载功能已修复并优化
