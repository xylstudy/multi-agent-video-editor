#!/usr/bin/env bash
set -euo pipefail

# ===== CONFIGURATION =====
# Paste your douyin share link here
DOUYIN_URL="https://v.douyin.com/xxxxx/"

# Output directory (relative to this script's location)
OUTPUT_DIR="$(dirname "$0")/output"

# Set to "true" for headless mode (faster, less reliable)
HEADLESS="false"
# =========================

SCRIPT_DIR="$(dirname "$0")"
PYTHON="$(which python3 || which python)"

echo "=== Douyin Video Downloader ==="
echo "URL: $DOUYIN_URL"
echo "Output: $OUTPUT_DIR"
echo ""

if [ "$HEADLESS" = "true" ]; then
    "$PYTHON" "$SCRIPT_DIR/downloader.py" "$DOUYIN_URL" "$OUTPUT_DIR" --headless
else
    "$PYTHON" "$SCRIPT_DIR/downloader.py" "$DOUYIN_URL" "$OUTPUT_DIR"
fi
