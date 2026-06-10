import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/137.0.0.0 Safari/537.36"
)

VIDEO_MIN_BYTES = 500 * 1024  # 500 KB minimum for full video


def _extract_video_urls_from_api(body: dict) -> list[tuple[str, int, dict]]:
    """Extract video URLs from douyin API response.

    Returns list of (url, bitrate, metadata_dict) sorted by bitrate descending.
    """
    results = []
    detail = body.get("aweme_detail")
    if not detail:
        return results

    video = detail.get("video", {})

    # Collect from bit_rate (various quality levels, usually watermark-free)
    for br in video.get("bit_rate", []):
        play_addr = br.get("play_addr", {})
        url_list = play_addr.get("url_list", [])
        if url_list:
            results.append((url_list[0], br.get("bit_rate", 0), {
                "width": play_addr.get("width"),
                "height": play_addr.get("height"),
            }))

    # Fallback: play_addr (watermarked)
    if not results:
        for key in ("play_addr", "play_addr_h264", "download_addr"):
            addr = video.get(key, {})
            url_list = addr.get("url_list", [])
            if url_list:
                results.append((url_list[0], 0, {}))
                break

    results.sort(key=lambda x: x[1], reverse=True)
    return results


def download_page(url: str, output_dir: str, headless: bool = False) -> tuple[Optional[str], dict]:
    """Open douyin video page in real browser, capture video URL and metadata.

    Returns (video_url, metadata_dict).
    """
    captured_video_url = None
    metadata: dict = {}
    best_video_url = None

    def on_response(response):
        nonlocal captured_video_url, metadata, best_video_url

        # Capture video detail API response for metadata + video URLs
        if "aweme/v1/web/aweme/detail" in response.url and response.status == 200:
            try:
                body = response.json()
                detail = body.get("aweme_detail")
                if detail:
                    metadata["video_id"] = detail.get("aweme_id", "")
                    metadata["title"] = detail.get("desc", "")
                    author_info = detail.get("author", {})
                    metadata["author"] = author_info.get("nickname", "")
                    metadata["author_id"] = author_info.get("uid", "")
                    statistics = detail.get("statistics", {})
                    metadata["like_count"] = statistics.get("digg_count", 0)
                    metadata["comment_count"] = statistics.get("comment_count", 0)
                    metadata["share_count"] = statistics.get("share_count", 0)
                    video_info = detail.get("video", {})
                    metadata["duration"] = (
                        video_info.get("duration", 0) / 1000
                        if video_info.get("duration") else None
                    )
                    metadata["width"] = video_info.get("width") or None
                    metadata["height"] = video_info.get("height") or None

                    # Extract video URLs from API response
                    urls = _extract_video_urls_from_api(body)
                    if urls:
                        best_video_url, best_br, br_meta = urls[0]
                        metadata["width"] = br_meta.get("width") or metadata["width"]
                        metadata["height"] = br_meta.get("height") or metadata["height"]
            except Exception:
                pass

        # Also intercept video network responses as fallback
        if captured_video_url:
            return
        ct = response.headers.get("content-type", "").lower()
        if "video/mp4" in ct or ct.startswith("video/"):
            cl = int(response.headers.get("content-length", "0"))
            if cl > VIDEO_MIN_BYTES:
                captured_video_url = response.url

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=headless,
            args=[
                "--disable-blink-features=AutomationControlled",
            ],
        )
        context = browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1920, "height": 1080},
            locale="zh-CN",
        )
        context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
        )
        page = context.new_page()
        page.on("response", on_response)

        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        time.sleep(3)

        # Scroll to trigger lazy load
        page.evaluate("window.scrollTo(0, 300)")
        time.sleep(2)

        # Click video to activate player
        try:
            page.click("video", timeout=5000)
        except Exception:
            pass

        # Wait for API response to arrive with video URLs
        deadline = time.time() + 15
        while not best_video_url and not captured_video_url and time.time() < deadline:
            time.sleep(1)

        if not metadata:
            metadata["video_id"] = _extract_id_from_url(page.url)
            metadata["title"] = page.title()

        browser.close()

    # Prefer API-extracted URL (full video) over intercepted stream (may be DASH segment)
    final_url = best_video_url or captured_video_url
    return final_url, metadata


def download_video_file(video_url: str, output_dir: str, video_id: str) -> str:
    """Download video from URL to local file."""
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f"douyin_{video_id}.mp4")

    req = urllib.request.Request(video_url)
    req.add_header("User-Agent", USER_AGENT)
    req.add_header("Referer", "https://www.douyin.com/")

    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
        with open(output_path, "wb") as f:
            f.write(data)

    return output_path


def save_metadata(metadata: dict, output_dir: str, source_url: str) -> str:
    """Save metadata dict as JSON file."""
    video_id = metadata.get("video_id", "unknown")
    record = {
        "video_id": video_id,
        "title": metadata.get("title", ""),
        "author": metadata.get("author", ""),
        "author_id": metadata.get("author_id", ""),
        "duration": metadata.get("duration"),
        "width": metadata.get("width"),
        "height": metadata.get("height"),
        "like_count": metadata.get("like_count"),
        "comment_count": metadata.get("comment_count"),
        "share_count": metadata.get("share_count"),
        "download_time": datetime.now().isoformat(),
        "source_url": source_url,
    }

    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f"douyin_{video_id}.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    return output_path


def _extract_id_from_url(url: str) -> str:
    match = re.search(r"/video/(\d+)", url)
    return match.group(1) if match else "unknown"


def main():
    if len(sys.argv) < 3:
        print("Usage: python downloader.py <URL> <OUTPUT_DIR> [--headless]",
              file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]
    base_dir = sys.argv[2]
    headless = "--headless" in sys.argv

    if "douyin.com" not in url:
        print(f"Error: Not a douyin URL — {url}", file=sys.stderr)
        sys.exit(1)

    print(f"Opening: {url}")
    video_url, metadata = download_page(url, base_dir, headless=headless)

    if not video_url:
        print("Error: Could not find video stream on the page", file=sys.stderr)
        print("The video may require login, be unavailable, or the page"
              " structure changed.", file=sys.stderr)
        sys.exit(4)

    video_id = metadata.get("video_id", _extract_id_from_url(url))
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    folder_name = f"{timestamp}_{video_id}"
    output_dir = os.path.join(base_dir, folder_name)

    print(f"Video ID: {video_id}")
    print(f"Title: {metadata.get('title', 'N/A')}")
    print(f"Downloading video...")

    mp4_path = download_video_file(video_url, output_dir, video_id)
    file_size_mb = os.path.getsize(mp4_path) / (1024 * 1024)
    print(f"Video saved: {mp4_path} ({file_size_mb:.1f} MB)")

    json_path = save_metadata(metadata, output_dir, url)
    print(f"Metadata saved: {json_path}")


if __name__ == "__main__":
    main()
