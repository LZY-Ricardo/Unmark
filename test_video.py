#!/usr/bin/env python3
"""
测试无Cookie视频解析
"""
import requests
import json

# 测试视频链接
test_cases = [
    {
        "name": "图集链接（已知）",
        "url": "https://v.douyin.com/4evJ3qVn5HA/",
        "expected_type": "images"
    },
    {
        "name": "视频链接测试",
        "url": "https://v.douyin.com/BRxwLdDhqHK/",  # 需要找到一个真实的视频链接
        "expected_type": "video"
    }
]

print("=" * 60)
print("COMPREHENSIVE NO-COOKIE PARSING TEST")
print("=" * 60)

for i, test in enumerate(test_cases, 1):
    print(f"\n[TEST {i}] {test['name']}")
    print(f"[URL] {test['url']}")

    try:
        response = requests.post(
            'http://localhost:3002/api/parse-no-cookie',
            json={'url': test['url']},
            headers={'Content-Type': 'application/json'},
            timeout=30
        )

        print(f"[STATUS] {response.status_code}")
        print(f"[TIME] {response.elapsed.total_seconds():.2f}s")

        if response.ok:
            data = response.json()

            if data.get('success'):
                result = data.get('data', {})
                result_type = result.get('type', 'unknown')

                print(f"[TYPE] {result_type}")
                print(f"[TITLE] {result.get('title', '')[:50]}")
                print(f"[AUTHOR] {result.get('author', {}).get('name', 'Unknown')}")

                if result_type == 'video':
                    has_video = bool(result.get('videoUrl'))
                    has_cover = bool(result.get('cover'))
                    print(f"[VIDEO] {'✓' if has_video else '✗'}")
                    print(f"[COVER] {'✓' if has_cover else '✗'}")
                elif result_type == 'images':
                    images = result.get('images', [])
                    print(f"[IMAGES] {len(images)} found ✓")

                # 验证类型
                if result_type == test['expected_type']:
                    print(f"[MATCH] Type matches expected: {test['expected_type']} ✓")
                else:
                    print(f"[MISMATCH] Expected {test['expected_type']}, got {result_type} ✗")

                print(f"[RESULT] PASS ✓")
            else:
                print(f"[ERROR] {data.get('error', 'Unknown error')}")
                print(f"[RESULT] FAIL ✗")
        else:
            print(f"[HTTP ERROR] {response.status_code}")
            print(f"[RESULT] FAIL ✗")

    except Exception as e:
        print(f"[EXCEPTION] {e}")
        print(f"[RESULT] FAIL ✗")

print("\n" + "=" * 60)
print("TEST SUITE COMPLETED")
print("=" * 60)
