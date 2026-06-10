param(
    [string[]]$Urls = @(),
    [switch]$Headless
)

# ===== CONFIGURATION =====
# Paste multiple douyin share links here (used when no command-line args)
$DOUYIN_URLS = @(
    "https://v.douyin.com/DASpTmCdmng/"
    # Add more URLs below:
    # "https://v.douyin.com/xxxxxxxxxx/"
)

# Output directory (relative to this script's location)
$OUTPUT_DIR = "$PSScriptRoot\output"
# =========================

# Use command-line args if provided, otherwise use config array
if ($Urls.Count -gt 0) {
    $URL_LIST = $Urls
} else {
    $URL_LIST = $DOUYIN_URLS
}

$DOWNLOADER = "$PSScriptRoot\downloader.py"
$PYTHON = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $PYTHON) {
    $PYTHON = (Get-Command python3 -ErrorAction SilentlyContinue).Source
}

Write-Host "=== Douyin Video Downloader ==="
Write-Host "Total URLs: $($URL_LIST.Count)"
Write-Host "Output: $OUTPUT_DIR"
Write-Host ""

$total = $URL_LIST.Count
$success = 0
$failed = 0

for ($i = 0; $i -lt $total; $i++) {
    $url = $URL_LIST[$i]
    Write-Host ("[{0}/{1}] Downloading: {2}" -f ($i + 1), $total, $url) -ForegroundColor Cyan

    $args = @($DOWNLOADER, $url, $OUTPUT_DIR)
    if ($Headless) { $args += "--headless" }

    $exitCode = 0
    & $PYTHON $args; $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        $success++
        Write-Host "  [OK] Done" -ForegroundColor Green
    } else {
        $failed++
        Write-Host "  [FAIL] Exit code: $exitCode" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "=== Summary ==="
Write-Host "Success: $success"
Write-Host "Failed : $failed"
Write-Host "Total  : $total"
