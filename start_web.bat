@echo off
setlocal EnableExtensions
chcp 65001 >nul
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"`) do set "PATH=%PATH%;%%P"

set "PROJECT_ROOT=%~dp0"
set "USE_CONDA=0"
set "PYTHON_EXE="

if defined VIDEOCLAW_PYTHON set "PYTHON_EXE=%VIDEOCLAW_PYTHON%"
if not defined PYTHON_EXE if exist "%PROJECT_ROOT%.venv\Scripts\python.exe" set "PYTHON_EXE=%PROJECT_ROOT%.venv\Scripts\python.exe"

if not defined PYTHON_EXE (
    where conda >nul 2>&1
    if not errorlevel 1 (
        conda run -n video-claw python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>&1
        if not errorlevel 1 set "USE_CONDA=1"
    )
)

if not defined PYTHON_EXE if "%USE_CONDA%"=="0" set "PYTHON_EXE=python"

echo Checking the runtime environment...
if "%USE_CONDA%"=="1" (
    conda run -n video-claw python "%PROJECT_ROOT%scripts\preflight.py" --web
) else (
    "%PYTHON_EXE%" "%PROJECT_ROOT%scripts\preflight.py" --web
)
if errorlevel 1 (
    echo.
    echo Startup aborted. Run this command from the project root first: powershell -ExecutionPolicy Bypass -File .\setup_windows.ps1
    pause
    exit /b 1
)

if /I "%~1"=="--check" exit /b 0

if "%USE_CONDA%"=="1" (
    start "VideoClaw-Backend :8000" /D "%PROJECT_ROOT%web\backend" cmd /k "conda run --no-capture-output -n video-claw python -m uvicorn main:app --host 127.0.0.1 --port 8000"
    start "VideoClaw-Frontend :5173" /D "%PROJECT_ROOT%web\frontend" cmd /k "conda run --no-capture-output -n video-claw npm run dev"
) else (
    start "VideoClaw-Backend :8000" /D "%PROJECT_ROOT%web\backend" cmd /k ""%PYTHON_EXE%" -m uvicorn main:app --host 127.0.0.1 --port 8000"
    start "VideoClaw-Frontend :5173" /D "%PROJECT_ROOT%web\frontend" cmd /k "npm run dev"
)

echo.
echo Backend API: http://127.0.0.1:8000/docs
echo Frontend: http://localhost:5173
echo Stop services by closing the two command windows.
echo.
endlocal

pause
