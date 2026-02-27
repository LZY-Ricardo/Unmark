#!/usr/bin/env python3
"""
Final validation test - no unicode chars
"""
import requests
import sys
import io

# Fix encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

print("=" * 60)
print("FINAL VALIDATION TEST")
print("=" * 60)

test_cases = [
    {
        "name": "Image Gallery (Known)",
        "url": "https://v.douyin.com/4evJ3qVn5HA/",
    },
]

success_count = 0
total_count = len(test_cases)

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
                    video_url = result.get('videoUrl', '')
                    cover_url = result.get('cover', '')
                    print(f"[VIDEO_URL] {bool(video_url)}")
                    print(f"[COVER_URL] {bool(cover_url)}")
                elif result_type == 'images':
                    images = result.get('images', [])
                    print(f"[IMAGES_COUNT] {len(images)}")
                    if images:
                        print(f"[FIRST_IMAGE] {images[0][:80]}...")

                print(f"[MODE] {data.get('mode', 'unknown')}")
                print(f"[RESULT] PASS")
                success_count += 1
            else:
                print(f"[ERROR] {data.get('error', 'Unknown error')}")
                print(f"[RESULT] FAIL")
        else:
            print(f"[HTTP_ERROR] {response.status_code}")
            print(f"[RESULT] FAIL")

    except Exception as e:
        print(f"[EXCEPTION] {str(e)[:100]}")
        print(f"[RESULT] FAIL")

print("\n" + "=" * 60)
print(f"SUMMARY: {success_count}/{total_count} tests passed")
print("=" * 60)

if success_count == total_count:
    print("\n[SUCCESS] All tests passed! No-cookie mode is working!")
    sys.exit(0)
else:
    print(f"\n[WARNING] Some tests failed")
    sys.exit(1)
