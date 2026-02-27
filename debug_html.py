#!/usr/bin/env python3
"""
保存抖音HTML用于调试
"""
import requests

url = "https://www.iesdouyin.com/share/video/7583570391357738297/"
headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U) AppleWebKit/537.36'
}

response = requests.get(url, headers=headers)

# 保存HTML
with open('douyin.html', 'w', encoding='utf-8') as f:
    f.write(response.text)

print(f"Saved HTML to douyin.html ({len(response.text)} bytes)")

# 搜索关键数据
if '__INITIAL_STATE__' in response.text:
    print("Found: __INITIAL_STATE__")
if 'window._SSR_HYDRATED_DATA' in response.text:
    print("Found: window._SSR_HYDRATED_DATA")
if 'self.__next_f' in response.text:
    print("Found: self.__next_f")
