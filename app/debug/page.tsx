'use client';

import { useState } from 'react';

export default function DebugPage() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const testParse = async () => {
    console.log('[DEBUG] Test button clicked!');
    console.log('[DEBUG] URL:', url);

    if (!url) {
      setError('请输入URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('[DEBUG] Sending request to /api/parse-no-cookie...');

      const response = await fetch('/api/parse-no-cookie', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      console.log('[DEBUG] Response status:', response.status);

      const data = await response.json();
      console.log('[DEBUG] Response data:', data);

      if (data.success) {
        setResult(data.data);
        console.log('[DEBUG] Parse successful!');
      } else {
        setError(data.error || '解析失败');
      }
    } catch (err: any) {
      console.error('[DEBUG] Error:', err);
      setError(err.message || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🔧 调试页面</h1>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          测试链接：
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="粘贴抖音链接"
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
      </div>

      <button
        onClick={testParse}
        disabled={loading}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: loading ? '#ccc' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '20px'
        }}
      >
        {loading ? '解析中...' : '测试解析'}
      </button>

      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#fee',
          border: '1px solid #f88',
          borderRadius: '4px',
          marginBottom: '20px',
          color: '#c00'
        }}>
          ❌ {error}
        </div>
      )}

      {result && (
        <div style={{
          padding: '15px',
          backgroundColor: '#efe',
          border: '1px solid #8c8',
          borderRadius: '4px'
        }}>
          <h3 style={{ marginTop: 0 }}>✅ 解析成功！</h3>
          <p><strong>类型：</strong>{result.type}</p>
          <p><strong>标题：</strong>{result.title?.substring(0, 50)}...</p>
          <p><strong>作者：</strong>{result.author?.name}</p>

          {result.type === 'images' ? (
            <p><strong>图片数量：</strong>{result.images?.length} 张</p>
          ) : (
            <p><strong>视频URL：</strong>{result.videoUrl?.substring(0, 50)}...</p>
          )}

          <details style={{ marginTop: '10px' }}>
            <summary>完整数据（点击展开）</summary>
            <pre style={{
              backgroundColor: '#f5f5f5',
              padding: '10px',
              overflow: 'auto',
              fontSize: '12px'
            }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <div style={{
        marginTop: '30px',
        padding: '15px',
        backgroundColor: '#f0f0f0',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <h3 style={{ marginTop: 0 }}>📋 调试步骤：</h3>
        <ol>
          <li>打开浏览器控制台（按F12）</li>
          <li>切换到 Console 标签</li>
          <li>点击"测试解析"按钮</li>
          <li>查看控制台输出（以 [DEBUG] 开头）</li>
          <li>如果控制台有错误，截图发给我</li>
        </ol>
      </div>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#e3f2fd',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <h3 style={{ marginTop: 0 }}>📝 API状态：</h3>
        <p>服务器端口：<strong>http://localhost:3004</strong></p>
        <p>API端点：<strong>/api/parse-no-cookie</strong></p>
        <p>测试命令：</p>
        <pre style={{
          backgroundColor: '#f5f5f5',
          padding: '10px',
          overflow: 'auto'
        }}>
          {'curl -X POST http://localhost:3004/api/parse-no-cookie \\\n' +
            '  -H "Content-Type: application/json" \\\n' +
            '  -d \'{"url":"https://v.douyin.com/4evJ3qVn5HA/"}\''}
        </pre>
      </div>
    </div>
  );
}
