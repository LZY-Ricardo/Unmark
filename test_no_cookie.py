#!/usr/bin/env python3
"""
测试无Cookie解析抖音视频
"""
import re
import json
import requests
from urllib.parse import urlparse, parse_qs

def extract_video_id(short_url):
    """从短链接中提取video_id或note_id"""
    # 先请求短链接获取重定向后的URL
    headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U) AppleWebKit/537.36'
    }
    response = requests.get(short_url, headers=headers, allow_redirects=True)
    final_url = response.url

    print(f"[DEBUG] Final URL: {final_url}")

    # 从URL中提取ID (支持video和note)
    if "/video/" in final_url:
        video_id = final_url.split("/video/")[1].split("/")[0]
        print(f"[DEBUG] Extracted video_id: {video_id}")
        return video_id

    # 尝试其他模式
    if "share/video/" in final_url:
        parts = final_url.split("share/video/")[1].split("/")
        video_id = parts[0] if parts else None
        print(f"[DEBUG] Extracted video_id (share): {video_id}")
        return video_id

    # 处理 note 类型（图集）
    if "/share/note/" in final_url:
        parts = final_url.split("share/note/")[1].split("/")[0].split("?")
        note_id = parts[0] if parts else None
        print(f"[DEBUG] Extracted note_id: {note_id}")
        return note_id

    print("[DEBUG] No ID found in URL")
    return None

def parse_douyin_no_cookie(video_id):
    """
    无Cookie解析抖音视频
    尝试多种方法提取数据
    """
    # 方法1: 尝试 share/video 接口
    url = f"https://www.iesdouyin.com/share/video/{video_id}/"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        'Referer': 'https://www.douyin.com/'
    }

    try:
        print(f"[REQUEST] Getting: {url}")
        response = requests.get(url, headers=headers, timeout=10)

        print(f"[STATUS] Code: {response.status_code}")
        print(f"[INFO] Content length: {len(response.text)}")

        # 尝试1: 正则提取 _ROUTER_DATA
        pattern = r'_ROUTER_DATA\s*=\s*(\{.*?\});'
        matches = re.findall(pattern, response.text)

        if matches:
            print(f"[FOUND] _ROUTER_DATA detected!")
            data = json.loads(matches[0])
            print("\n[DATA STRUCTURE]")
            print(json.dumps(data, indent=2, ensure_ascii=False)[:500] + "...")
            return data

        # 尝试2: 直接搜索包含 video_url 或 play_addr 的JSON块
        print("\n[TRY] Looking for video data JSON...")

        # 搜索可能包含数据的模式
        patterns = [
            r'video_id["\']?\s*:\s*["\']([^"\']+)',
            r'play_addr["\']?\s*:\s*\{[^}]*url_list["\']?\s*:\s*\[([^\]]+)\]',
            r'"desc"\s*:\s*"([^"]+)"',  # 视频标题
        ]

        for pattern_str in patterns:
            matches = re.findall(pattern_str, response.text)
            if matches:
                print(f"[FOUND] Pattern matched: {pattern_str[:50]}...")
                print(f"[DATA] {matches[:3]}")

        # 尝试3: 提取整个大的JSON对象
        print("\n[TRY] Extracting large JSON objects...")
        # 查找 { 开始，然后尝试找到匹配的 }
        start_idx = response.text.find('{"desc"')
        if start_idx != -1:
            # 尝试提取完整的JSON
            bracket_count = 0
            in_string = False
            escape = False
            end_idx = start_idx

            for i in range(start_idx, min(start_idx + 50000, len(response.text))):
                char = response.text[i]

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

            if end_idx > start_idx:
                json_str = response.text[start_idx:end_idx]
                print(f"[EXTRACTED] JSON length: {len(json_str)}")
                try:
                    data = json.loads(json_str)
                    print(f"[SUCCESS] Parsed JSON successfully!")
                    print(f"[DATA] Keys: {list(data.keys())[:10]}")

                    # 打印关键信息
                    if 'desc' in data:
                        print(f"\n[TITLE] {data.get('desc', '')[:100]}")
                    if 'video' in data and 'play_addr' in data['video']:
                        urls = data['video']['play_addr'].get('url_list', [])
                        print(f"[VIDEO URL] {urls[0] if urls else 'N/A'}")

                    return data
                except Exception as e:
                    print(f"[ERROR] Failed to parse JSON: {e}")

        print("[NOT FOUND] No extractable data")
        return None

    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    # 测试链接
    test_url = "https://v.douyin.com/4evJ3qVn5HA/"

    print("=" * 60)
    print("[TEST] No-Cookie Douyin Parser")
    print("=" * 60)

    # 提取video_id
    print(f"\n[URL] Test link: {test_url}")
    video_id = extract_video_id(test_url)

    if video_id:
        print(f"[OK] video_id: {video_id}")
    else:
        print("[ERROR] Cannot extract video_id")
        return

    # 解析视频
    data = parse_douyin_no_cookie(video_id)

    if data:
        print("\n[SUCCESS] No-cookie parsing successful!")
        print("=" * 60)
    else:
        print("\n[FAILED] Parsing failed")
        print("=" * 60)

if __name__ == "__main__":
    main()
