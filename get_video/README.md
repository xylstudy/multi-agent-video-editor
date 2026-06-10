# Douyin Video Downloader

Download douyin videos via share link using a real browser (Playwright).
Outputs MP4 + JSON metadata per video.

## Quick Start

### 1. Install dependencies

```powershell
pip install -r requirements.txt
python -m playwright install chromium
```

### 2. Configure

Edit `download.ps1`:

```powershell
$DOUYIN_URL = "https://v.douyin.com/xxxxx/"   # your share link
$OUTPUT_DIR = "$PSScriptRoot\output"            # where to save
$HEADLESS = $false                              # $true = invisible browser
```

### 3. Run

```powershell
.\download.ps1
```

A Chromium window opens, navigates to the video page, captures the video stream, and saves it.

## Output Structure

```
output/
└── 20260524_213000_7628202769404480777/
    ├── douyin_7628202769404480777.mp4
    └── douyin_7628202769404480777.json
```

Each download creates a folder named `{timestamp}_{video_id}/` containing the video and its metadata JSON.

## Cookie / Login

**No manual cookie configuration needed.** The tool launches a real Chromium browser that generates fresh cookies and anti-bot tokens (msToken, a_bogus, ttwid) automatically via JavaScript — the same way a normal browser visit works.

If a video requires login, log into douyin.com in the opened browser window, then re-run the download. The session persists within the download session.

## How It Works

1. Playwright launches Chromium with stealth patches (hides automation markers)
2. Navigates to the douyin video page — the browser resolves short links and generates anti-bot tokens
3. Intercepts the video detail API response to extract metadata (title, author, stats) and video URLs at all quality levels
4. Selects the highest bitrate stream from the API response
5. Downloads the MP4 directly from douyin's CDN with proper Referer headers

## Requirements

- Windows / macOS / Linux
- Python 3.9+
- Playwright + Chromium (`python -m playwright install chromium`)
