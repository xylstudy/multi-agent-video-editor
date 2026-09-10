[CmdletBinding()]
param(
    [ValidateSet("conda", "venv")]
    [string]$Mode = "venv",
    [string]$PythonExecutable = "",
    [switch]$SkipBrowser
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

function Update-ProcessPath {
    $MachinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$env:Path;$MachinePath;$UserPath"
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
    )
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed ($LASTEXITCODE): $FilePath $($Arguments -join ' ')"
    }
}

function Install-WingetPackage {
    param([Parameter(Mandatory = $true)][string]$Id)
    $Winget = (Get-Command winget -ErrorAction Stop).Source
    Write-Host "Installing missing system dependency: $Id"
    Invoke-Checked $Winget install --id $Id --exact --silent --accept-package-agreements --accept-source-agreements
    Update-ProcessPath
}

Update-ProcessPath

Push-Location $ProjectRoot
try {
    if ($Mode -eq "conda") {
        $Conda = (Get-Command conda -ErrorAction Stop).Source
        Write-Host "[1/5] Creating or updating Conda environment video-claw..."
        Invoke-Checked $Conda env update --name video-claw --file environment.yml --prune

        Write-Host "[2/5] Installing frontend dependencies..."
        Invoke-Checked $Conda run -n video-claw npm ci --prefix web/frontend

        Write-Host "[3/5] Installing Remotion dependencies..."
        Invoke-Checked $Conda run -n video-claw npm ci --prefix viral-structure-engine/remotion

        if (-not $SkipBrowser) {
            Write-Host "[4/5] Installing Playwright Chromium..."
            Invoke-Checked $Conda run -n video-claw python -m playwright install chromium
        } else {
            Write-Host "[4/5] Skipping Playwright Chromium"
        }

        Write-Host "[5/5] Validating environment..."
        Invoke-Checked $Conda run -n video-claw python scripts/preflight.py --full
    } else {
        if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
            Install-WingetPackage "Gyan.FFmpeg"
        }
        $NodeSupported = $false
        if (Get-Command node -ErrorAction SilentlyContinue) {
            $NodeParts = ((& node --version).TrimStart("v")).Split(".")
            if ($NodeParts.Count -ge 2) {
                $NodeMajor = [int]$NodeParts[0]
                $NodeMinor = [int]$NodeParts[1]
                $NodeSupported = (($NodeMajor -eq 20 -and $NodeMinor -ge 19) -or $NodeMajor -ge 22)
            }
        }
        if (-not $NodeSupported) {
            Install-WingetPackage "OpenJS.NodeJS.LTS"
        }

        if ($PythonExecutable) {
            $Python = (Resolve-Path -LiteralPath $PythonExecutable -ErrorAction Stop).Path
        } else {
            $Python312 = Join-Path $env:LocalAppData "Programs\Python\Python312\python.exe"
            if (-not (Test-Path -LiteralPath $Python312)) {
                Install-WingetPackage "Python.Python.3.12"
            }
            if (Test-Path -LiteralPath $Python312) {
                $Python = $Python312
            } else {
                $Python = (Get-Command python -ErrorAction Stop).Source
            }
        }
        & $Python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)"
        if ($LASTEXITCODE -ne 0) {
            throw "The current Python is older than 3.11. Install Python 3.12 or use the default conda mode."
        }

        Write-Host "[1/5] Creating .venv..."
        Invoke-Checked $Python -m venv .venv
        $VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

        Write-Host "[2/5] Installing Python dependencies..."
        Invoke-Checked $VenvPython -m pip install --upgrade pip
        Invoke-Checked $VenvPython -m pip install -c requirements-lock.txt -r requirements-dev.txt

        Write-Host "[3/5] Installing Node dependencies..."
        Invoke-Checked npm ci --prefix web/frontend
        Invoke-Checked npm ci --prefix viral-structure-engine/remotion

        if (-not $SkipBrowser) {
            Write-Host "[4/5] Installing Playwright Chromium..."
            Invoke-Checked $VenvPython -m playwright install chromium
        } else {
            Write-Host "[4/5] Skipping Playwright Chromium"
        }

        Write-Host "[5/5] Validating environment..."
        Invoke-Checked $VenvPython scripts/preflight.py --full
    }

    Write-Host "`nSetup complete. Run .\start_web.bat to start the Web app." -ForegroundColor Green
} finally {
    Pop-Location
}
