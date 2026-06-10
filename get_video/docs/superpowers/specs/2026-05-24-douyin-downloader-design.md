# Douyin Video Downloader — Design Spec

## Overview

A shell-driven tool to download douyin videos and metadata for research use.
User provides a share link + browser cookie, and gets back an MP4 file plus a
JSON metadata file.

## File Structure

```
douyin/
├── download.sh           # Entry point — user configures URL, cookie, output dir
├── downloader.py          # Core script using yt-dlp Python API
├── requirements.txt       # yt-dlp
└── output/                # Downloaded artifacts (auto-created)
    ├── douyin_{video_id}.mp4
    └── douyin_{video_id}.json
```

## Components

### download.sh

The only file the user edits. Contains three variables:

- `DOUYIN_URL` — full share link (e.g. `https://v.douyin.com/xxxxx/`)
- `COOKIE` — raw cookie string pasted from browser devtools
- `OUTPUT_DIR` — where to save files (default `./output`)

Passes all three to `downloader.py` as CLI args.

### downloader.py

Three-step pipeline:

1. **Resolve** — extract video_id from the share link (follow redirects if needed),
   build the douyin video page URL
2. **Download** — call yt-dlp Python API with cookie + custom headers
   (User-Agent, Referer), save video as `douyin_{video_id}.mp4`
3. **Metadata** — extract title, author, duration, resolution, like count, etc.
   from yt-dlp info dict, write to `douyin_{video_id}.json`

### Custom Headers

Must include to avoid bot detection:

- `User-Agent` — Chrome 137 on Windows (matching the user's browser)
- `Referer` — `https://www.douyin.com/`
- `Cookie` — raw cookie string from user config

### JSON Metadata Schema

```json
{
  "video_id": "7628202769404480777",
  "title": "video title",
  "author": "author name",
  "author_id": "author_uid",
  "duration": 30.5,
  "width": 1080,
  "height": 1920,
  "like_count": 12345,
  "comment_count": 678,
  "share_count": 90,
  "download_time": "2026-05-24T15:30:00",
  "source_url": "https://v.douyin.com/xxxxx/"
}
```

## Error Handling

- Invalid/malformed URL → print error and exit with code 1
- Cookie expired / login required → print error and exit with code 2
- Network failure → print error and exit with code 3
- Video unavailable / deleted → print error and exit with code 4

## Dependencies

- Python ≥ 3.9
- `yt-dlp` (pip install)

## Out of Scope

- Batch downloading from a link list (can be added later by looping in download.sh)
- Watermark removal (yt-dlp handles this automatically)
- GUI or web interface
