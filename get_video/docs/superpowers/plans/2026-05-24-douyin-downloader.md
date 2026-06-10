# Douyin Video Downloader — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shell-driven tool that downloads douyin videos and saves metadata as JSON.

**Architecture:** A shell script (`download.sh`) holds user config (URL, cookie, output dir) and calls `downloader.py`. The Python script resolves the share link → downloads via yt-dlp Python API → saves `<video_id>.mp4` + `<video_id>.json` to the output dir.

**Tech Stack:** Python 3.9+, yt-dlp (pip), pytest (dev)

---

### Task 1: Project scaffold

**Files:**
- Create: `requirements.txt`
- Create: `tests/__init__.py`
- Create: `tests/conftest.py`
- Create: `tests/test_downloader.py`

- [ ] **Step 1: Write requirements.txt**

```
yt-dlp>=2024.0.0
```

- [ ] **Step 2: Write tests/conftest.py**

```python
import pytest


@pytest.fixture
def sample_share_url():
    return "https://v.douyin.com/iRxxxxx/"


@pytest.fixture
def sample_cookie():
    return "sessionid=abc123; uid_tt=def456"


@pytest.fixture
def sample_video_id():
    return "7628202769404480777"


@pytest.fixture
def sample_info_dict():
    return {
        "id": "7628202769404480777",
        "title": "测试视频标题",
        "uploader": "测试作者",
        "uploader_id": "author_uid_123",
        "duration": 30.5,
        "width": 1080,
        "height": 1920,
        "like_count": 12345,
        "comment_count": 678,
        "share_count": 90,
        "webpage_url": "https://www.douyin.com/video/7628202769404480777",
    }
```

- [ ] **Step 3: Write tests/__init__.py**

```python
# Empty init for test package
```

- [ ] **Step 4: Install deps and verify**

Run: `pip install -r requirements.txt pytest`
Run: `python -c "import yt_dlp; print(yt_dlp.version.__version__)"`
Expected: yt-dlp version printed

- [ ] **Step 5: Commit**

```bash
git add requirements.txt tests/
git commit -m "chore: scaffold project with dependencies and test setup"
```

---

### Task 2: Video ID extractor

**Files:**
- Create: `downloader.py`
- Modify: `tests/test_downloader.py`

- [ ] **Step 1: Write failing tests for extract_video_id**

Add to `tests/test_downloader.py`:

```python
from downloader import extract_video_id


def test_extract_video_id_from_full_url():
    url = "https://www.douyin.com/video/7628202769404480777"
    assert extract_video_id(url) == "7628202769404480777"


def test_extract_video_id_with_query_params():
    url = "https://www.douyin.com/video/7628202769404480777?modal_id=999"
    assert extract_video_id(url) == "7628202769404480777"


def test_extract_video_id_from_share_url():
    url = "https://v.douyin.com/iRxxxxx/"
    assert extract_video_id(url) is not None
    assert len(extract_video_id(url)) > 0
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pytest tests/test_downloader.py -v`
Expected: 3 FAIL (ImportError, no `downloader` module)

- [ ] **Step 3: Implement extract_video_id**

Write `downloader.py`:

```python
import re
import urllib.request
import urllib.error


def extract_video_id(url: str) -> str:
    """Extract the numeric douyin video ID from any URL format.

    Handles:
      - Full page URL: https://www.douyin.com/video/7628202769404480777
      - Share short link: https://v.douyin.com/iRxxxxx/ (follows redirect)
    """
    # Try direct pattern match first (full URL)
    match = re.search(r"/video/(\d+)", url)
    if match:
        return match.group(1)

    # Follow redirect for short links
    try:
        req = urllib.request.Request(
            url,
            method="HEAD",
            headers={"User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            final_url = resp.geturl()
        match = re.search(r"/video/(\d+)", final_url)
        if match:
            return match.group(1)
    except Exception:
        pass

    raise ValueError(f"Could not extract video ID from URL: {url}")
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `pytest tests/test_downloader.py -v`
Expected: 3 PASS

- [ ] **Step 5: Commit**

```bash
git add downloader.py tests/test_downloader.py
git commit -m "feat: add extract_video_id with redirect resolution"
```

---

### Task 3: Metadata saver

**Files:**
- Modify: `downloader.py`
- Modify: `tests/test_downloader.py`

- [ ] **Step 1: Write failing test for save_metadata**

Add to `tests/test_downloader.py`:

```python
import json
import tempfile
import os
from datetime import datetime
from downloader import save_metadata


def test_save_metadata(sample_info_dict):
    with tempfile.TemporaryDirectory() as tmpdir:
        source_url = "https://v.douyin.com/iRxxxxx/"
        save_metadata(sample_info_dict, tmpdir, source_url)

        output_path = os.path.join(tmpdir, "douyin_7628202769404480777.json")
        assert os.path.exists(output_path)

        with open(output_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        assert data["video_id"] == "7628202769404480777"
        assert data["title"] == "测试视频标题"
        assert data["author"] == "测试作者"
        assert data["author_id"] == "author_uid_123"
        assert data["duration"] == 30.5
        assert data["width"] == 1080
        assert data["height"] == 1920
        assert data["like_count"] == 12345
        assert data["comment_count"] == 678
        assert data["share_count"] == 90
        assert data["source_url"] == source_url
        assert "download_time" in data
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pytest tests/test_downloader.py::test_save_metadata -v`
Expected: FAIL (ImportError, no `save_metadata`)

- [ ] **Step 3: Implement save_metadata**

Add to `downloader.py` after the `extract_video_id` function:

```python
import json as json_module
import os
from datetime import datetime


def save_metadata(info: dict, output_dir: str, source_url: str) -> str:
    """Extract metadata from yt-dlp info dict and save as JSON."""
    video_id = info.get("id", "unknown")
    metadata = {
        "video_id": video_id,
        "title": info.get("title", ""),
        "author": info.get("uploader", ""),
        "author_id": info.get("uploader_id", ""),
        "duration": info.get("duration"),
        "width": info.get("width"),
        "height": info.get("height"),
        "like_count": info.get("like_count"),
        "comment_count": info.get("comment_count"),
        "share_count": info.get("share_count"),
        "download_time": datetime.now().isoformat(),
        "source_url": source_url,
    }

    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f"douyin_{video_id}.json")

    with open(output_path, "w", encoding="utf-8") as f:
        json_module.dump(metadata, f, ensure_ascii=False, indent=2)

    return output_path
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pytest tests/test_downloader.py::test_save_metadata -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add downloader.py tests/test_downloader.py
git commit -m "feat: add save_metadata to write JSON metadata files"
```

---

### Task 4: yt-dlp download with cookie headers

**Files:**
- Modify: `downloader.py`
- Modify: `tests/test_downloader.py`

- [ ] **Step 1: Write failing test for build_ytdlp_options**

Add to `tests/test_downloader.py`:

```python
from downloader import build_ytdlp_options


def test_build_ytdlp_options(sample_cookie):
    opts = build_ytdlp_options(output_dir="/tmp/test_output", cookie=sample_cookie)

    assert opts["outtmpl"] == "/tmp/test_output/douyin_%(id)s.%(ext)s"
    assert opts["quiet"] is True
    assert opts["no_warnings"] is True
    assert "http_headers" in opts
    headers = opts["http_headers"]
    assert headers["Cookie"] == sample_cookie
    assert headers["User-Agent"] == (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/137.0.0.0 Safari/537.36"
    )
    assert headers["Referer"] == "https://www.douyin.com/"
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pytest tests/test_downloader.py::test_build_ytdlp_options -v`
Expected: FAIL (ImportError, no `build_ytdlp_options`)

- [ ] **Step 3: Implement build_ytdlp_options**

Add to `downloader.py`:

```python
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/137.0.0.0 Safari/537.36"
)


def build_ytdlp_options(output_dir: str, cookie: str) -> dict:
    """Build yt-dlp option dict with custom headers and output template."""
    return {
        "outtmpl": f"{output_dir}/douyin_%(id)s.%(ext)s",
        "quiet": True,
        "no_warnings": True,
        "http_headers": {
            "Cookie": cookie,
            "User-Agent": USER_AGENT,
            "Referer": "https://www.douyin.com/",
        },
    }
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pytest tests/test_downloader.py::test_build_ytdlp_options -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add downloader.py tests/test_downloader.py
git commit -m "feat: add build_ytdlp_options with custom headers"
```

---

### Task 5: Download orchestration function

**Files:**
- Modify: `downloader.py`
- Modify: `tests/test_downloader.py`

- [ ] **Step 1: Write failing test for download_video**

Add to `tests/test_downloader.py`:

```python
from unittest.mock import patch, MagicMock
from downloader import download_video


@patch("yt_dlp.YoutubeDL")
def test_download_video_calls_ytdlp(mock_ydl, sample_info_dict):
    mock_instance = MagicMock()
    mock_instance.extract_info.return_value = sample_info_dict
    mock_ydl.return_value.__enter__.return_value = mock_instance

    url = "https://www.douyin.com/video/7628202769404480777"
    cookie = "sessionid=abc123"
    opts = build_ytdlp_options("/tmp/test", cookie)

    info = download_video(url, opts)

    # yt-dlp is called with the right URL
    mock_instance.extract_info.assert_called_once()
    call_args = mock_instance.extract_info.call_args[0]
    assert call_args[0] == url
    # yt-dlp downloads (download=True implicitly via the call args or we set it)
    assert call_args[1] is True  # download=True

    # Info dict is returned
    assert info == sample_info_dict
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pip install yt-dlp && pytest tests/test_downloader.py::test_download_video_calls_ytdlp -v`
Expected: FAIL (ImportError, not yet implemented)

- [ ] **Step 3: Implement download_video**

Add to `downloader.py`:

```python
import yt_dlp


class DownloadError(Exception):
    """Raised when download fails for a known reason."""


def download_video(url: str, ytdlp_options: dict) -> dict:
    """Download a video using yt-dlp and return the info dict.

    Raises DownloadError with exit code:
      2 — login / cookie required
      3 — network failure
      4 — video unavailable
    """
    ytdlp_options["extract_flat"] = False

    try:
        with yt_dlp.YoutubeDL(ytdlp_options) as ydl:
            info = ydl.extract_info(url, download=True)
            if info is None:
                raise DownloadError("No info returned", 4)
            return info
    except yt_dlp.utils.DownloadError as e:
        msg = str(e).lower()
        if "login" in msg or "cookie" in msg:
            raise DownloadError(f"Login required: {e}", 2)
        if "unavailable" in msg or "deleted" in msg or "private" in msg:
            raise DownloadError(f"Video unavailable: {e}", 4)
        raise DownloadError(f"Download failed: {e}", 3)
    except Exception as e:
        msg = str(e).lower()
        if "connection" in msg or "timeout" in msg or "network" in msg:
            raise DownloadError(f"Network error: {e}", 3)
        raise DownloadError(f"Unexpected error: {e}", 3)
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pytest tests/test_downloader.py::test_download_video_calls_ytdlp -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add downloader.py tests/test_downloader.py
git commit -m "feat: add download_video orchestration with error handling"
```

---

### Task 6: CLI main function

**Files:**
- Modify: `downloader.py`

- [ ] **Step 1: Implement main() entry point**

Append to `downloader.py`:

```python
import sys


def main():
    if len(sys.argv) != 4:
        print("Usage: python downloader.py <URL> <COOKIE> <OUTPUT_DIR>", file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]
    cookie = sys.argv[2]
    output_dir = sys.argv[3]

    # Validate URL
    if "douyin.com" not in url:
        print(f"Error: Not a douyin URL — {url}", file=sys.stderr)
        sys.exit(1)

    try:
        # Step 1: Resolve video ID
        print(f"Resolving: {url}")
        video_id = extract_video_id(url)
        print(f"Video ID: {video_id}")

        # Step 2: Build options and download
        print("Downloading video...")
        opts = build_ytdlp_options(output_dir, cookie)
        info = download_video(url, opts)
        print(f"Downloaded: {output_dir}/douyin_{video_id}.mp4")

        # Step 3: Save metadata
        json_path = save_metadata(info, output_dir, url)
        print(f"Metadata saved: {json_path}")

    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except DownloadError as e:
        print(f"Error: {e}", file=sys.stderr)
        _, code = e.args
        sys.exit(code)
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        sys.exit(3)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify module is importable**

Run: `python -c "from downloader import main, extract_video_id, build_ytdlp_options, save_metadata, download_video; print('OK')"`
Expected: OK

- [ ] **Step 3: Commit**

```bash
git add downloader.py
git commit -m "feat: add CLI main() with full download pipeline"
```

---

### Task 7: Shell entry point

**Files:**
- Create: `download.sh`

- [ ] **Step 1: Write download.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

# ===== CONFIGURATION =====
# Paste your douyin share link here
DOUYIN_URL="https://v.douyin.com/xxxxx/"

# Paste your browser cookie string here
COOKIE="enter_pc_once=1; sessionid=xxx; uid_tt=xxx"

# Output directory (relative to this script's location)
OUTPUT_DIR="$(dirname "$0")/output"
# =========================

SCRIPT_DIR="$(dirname "$0")"
PYTHON="$(which python3 || which python)"

echo "=== Douyin Video Downloader ==="
echo "URL: $DOUYIN_URL"
echo "Output: $OUTPUT_DIR"
echo ""

"$PYTHON" "$SCRIPT_DIR/downloader.py" "$DOUYIN_URL" "$COOKIE" "$OUTPUT_DIR"
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x /e/data/douyin/download.sh`

- [ ] **Step 3: Commit**

```bash
git add download.sh
git commit -m "feat: add download.sh entry point with user config"
```

---

### Task 8: Full test suite run

- [ ] **Step 1: Run all tests**

Run: `pytest tests/ -v`
Expected: All tests PASS (5 tests)

- [ ] **Step 2: Run all tests one final time**

Run: `pytest tests/ -v`  
Expected: 5 passed
