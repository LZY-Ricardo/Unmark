#!/usr/bin/env python3
"""
提取 window._ROUTER_DATA
"""
import re
import json

# 读取HTML
content = open('douyin.html', 'r', encoding='utf-8').read()

# 提取 _ROUTER_DATA
pattern = r'window\._ROUTER_DATA\s*=\s*(\{.*?\});'
matches = re.findall(pattern, content, re.DOTALL)

if matches:
    print(f"[FOUND] _ROUTER_DATA!")
    print(f"[LENGTH] {len(matches[0])} characters")

    try:
        data = json.loads(matches[0])
        print(f"[SUCCESS] Parsed JSON successfully!")
        print(f"\n[TOP LEVEL KEYS]")
        for key in list(data.keys())[:10]:
            print(f"  - {key}")

        # 保存完整数据
        with open('router_data.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"\n[SAVED] Full data saved to router_data.json")

        # 尝试找到视频/图片数据
        if 'loaderData' in data:
            print(f"\n[LOADER DATA KEYS]")
            for key in list(data['loaderData'].keys())[:10]:
                print(f"  - {key}")

    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON parse error: {e}")
        print(f"\n[FIRST 500 CHARS]")
        print(matches[0][:500])
else:
    print("[NOT FOUND] No _ROUTER_DATA")
