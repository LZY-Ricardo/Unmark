#!/usr/bin/env python3
"""
测试无Cookie解析API
"""
import requests
import json

print("=" * 60)
print("Testing No-Cookie Parse API")
print("=" * 60)

# 测试URL
test_url = "https://v.douyin.com/4evJ3qVn5HA/"

print(f"\n[TEST URL] {test_url}")
print("[TARGET] http://localhost:3002/api/parse-no-cookie")

try:
    response = requests.post(
        'http://localhost:3002/api/parse-no-cookie',
        json={'url': test_url},
        headers={'Content-Type': 'application/json'},
        timeout=30
    )

    print(f"\n[STATUS] {response.status_code}")
    print(f"[TIME] {response.elapsed.total_seconds():.2f}s")

    data = response.json()

    if response.ok and data.get('success'):
        print(f"\n[SUCCESS] Parsing successful!")
        print(f"[MODE] {data.get('mode', 'unknown')}")

        result = data.get('data', {})

        print(f"\n[RESULT TYPE] {result.get('type', 'unknown')}")
        print(f"[TITLE] {result.get('title', '')[:50]}")
        print(f"[AUTHOR] {result.get('author', {}).get('name', 'Unknown')}")

        if result.get('type') == 'video':
            print(f"\n[VIDEO URL] {result.get('videoUrl', '')[:80]}...")
            print(f"[COVER] {result.get('cover', '')[:80]}...")
        elif result.get('type') == 'images':
            images = result.get('images', [])
            print(f"\n[IMAGES] Found {len(images)} images")
            for i, url in enumerate(images[:3]):
                print(f"  [{i+1}] {url[:80]}...")

        print("\n[VALIDATION] All checks passed!")
        print("=" * 60)
    else:
        print(f"\n[FAILED] {data.get('error', 'Unknown error')}")
        print(f"[RESPONSE] {json.dumps(data, indent=2, ensure_ascii=False)}")
        print("=" * 60)

except Exception as e:
    print(f"\n[ERROR] {e}")
    import traceback
    traceback.print_exc()
    print("=" * 60)
