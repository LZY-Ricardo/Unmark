#!/usr/bin/env python3
"""
提取 window._ROUTER_DATA - 改进版
"""
import json

# 读取HTML
content = open('douyin.html', 'r', encoding='utf-8').read()

# 找到 _ROUTER_DATA 的起始位置
marker = 'window._ROUTER_DATA = '
start_idx = content.find(marker)

if start_idx != -1:
    print(f"[FOUND] _ROUTER_DATA at position {start_idx}")

    # 从标记后开始
    start_idx += len(marker)

    # 找到匹配的结束位置
    bracket_count = 0
    in_string = False
    escape = False

    for i in range(start_idx, len(content)):
        char = content[i]

        if escape:
            escape = False
            continue

        if char == '\\':
            escape = True
            continue

        if char == '"' and not escape:
            in_string = not in_string
            continue

        if not in_string:
            if char == '{':
                bracket_count += 1
            elif char == '}':
                bracket_count -= 1
                if bracket_count == 0:
                    end_idx = i + 1
                    break

    # 提取JSON字符串
    json_str = content[start_idx:end_idx]
    print(f"[EXTRACTED] {len(json_str)} characters")

    try:
        data = json.loads(json_str)
        print(f"[SUCCESS] Parsed JSON successfully!")

        # 保存完整数据
        with open('router_data.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"[SAVED] router_data.json ({len(data)} top-level keys)")

        # 显示关键信息
        print(f"\n[TOP LEVEL KEYS]")
        for key in list(data.keys())[:10]:
            value = data[key]
            if isinstance(value, dict):
                print(f"  - {key}: dict with {len(value)} keys")
            elif isinstance(value, list):
                print(f"  - {key}: list with {len(value)} items")
            else:
                print(f"  - {key}: {type(value).__name__}")

        # 查找视频/图片数据
        if 'loaderData' in data:
            loader = data['loaderData']
            print(f"\n[LOADER DATA]")

            for key in loader.keys():
                if 'video' in key.lower() or 'note' in key.lower() or 'image' in key.lower():
                    print(f"  - {key}")
                    value = loader[key]
                    if value and isinstance(value, dict):
                        for subkey in list(value.keys())[:5]:
                            print(f"      - {subkey}")

    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON parse failed: {e}")
        print(f"\n[FIRST 1000 CHARS]")
        print(json_str[:1000])
else:
    print("[NOT FOUND] _ROUTER_DATA")
