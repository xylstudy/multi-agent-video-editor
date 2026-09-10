"""Validate the local runtime before starting Video Claw.

The script deliberately avoids importing project modules so that a broken or
partially installed environment produces one concise, actionable report.
"""

from __future__ import annotations

import argparse
import importlib.util
import os
import shutil
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
PYTHON_MODULES = {
    "fastapi": "fastapi",
    "uvicorn": "uvicorn",
    "sqlmodel": "sqlmodel",
    "python-jose": "jose",
    "bcrypt": "bcrypt",
    "python-multipart": "multipart",
    "aiofiles": "aiofiles",
    "httpx": "httpx",
    "pydantic": "pydantic",
    "python-dotenv": "dotenv",
    "langgraph": "langgraph",
    "langchain-core": "langchain_core",
    "opencv-python": "cv2",
    "numpy": "numpy",
    "Pillow": "PIL",
    "librosa": "librosa",
}
FULL_MODULES = {
    "pytest": "pytest",
    "pytest-asyncio": "pytest_asyncio",
    "playwright": "playwright",
}


def _command_version(command: str) -> str | None:
    executable = shutil.which(command)
    if not executable:
        return None
    try:
        completed = subprocess.run(
            [executable, "--version"],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    output = (completed.stdout or completed.stderr).strip().splitlines()
    return output[0] if output else None


def _node_is_supported(version: str) -> bool:
    raw = version.lower().lstrip("v")
    try:
        major, minor, *_ = (int(part) for part in raw.split("."))
    except ValueError:
        return False
    return (major == 20 and minor >= 19) or major >= 22


def _check_modules(modules: dict[str, str], failures: list[str]) -> None:
    missing = [package for package, module in modules.items() if importlib.util.find_spec(module) is None]
    if missing:
        failures.append("Missing Python packages: " + ", ".join(missing))
    else:
        print(f"[OK] Python dependencies ({len(modules)} packages)")


def _find_playwright_chromium() -> Path | None:
    configured_root = os.getenv("PLAYWRIGHT_BROWSERS_PATH")
    roots: list[Path] = []
    if configured_root and configured_root != "0":
        roots.append(Path(configured_root).expanduser())
    if sys.platform == "win32" and os.getenv("LOCALAPPDATA"):
        roots.append(Path(os.environ["LOCALAPPDATA"]) / "ms-playwright")
    elif sys.platform == "darwin":
        roots.append(Path.home() / "Library" / "Caches" / "ms-playwright")
    else:
        roots.append(Path.home() / ".cache" / "ms-playwright")

    patterns = (
        "chromium-*/chrome-win*/chrome.exe",
        "chromium-*/chrome-linux*/chrome",
        "chromium-*/chrome-mac*/Chromium.app/Contents/MacOS/Chromium",
    )
    for root in roots:
        for pattern in patterns:
            match = next(root.glob(pattern), None) if root.exists() else None
            if match and match.is_file():
                return match
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Video Claw runtime preflight")
    parser.add_argument("--full", action="store_true", help="also check test and downloader dependencies")
    parser.add_argument("--web", action="store_true", help="check Web, engine, and renderer dependencies")
    args = parser.parse_args()

    failures: list[str] = []
    warnings: list[str] = []

    print("Video Claw environment preflight")
    print(f"[INFO] Project root: {PROJECT_ROOT}")
    print(f"[INFO] Python: {sys.executable} ({sys.version.split()[0]})")

    if sys.version_info < (3, 11):
        failures.append("Python is too old; 3.11+ is required and 3.12 is recommended")
    elif sys.version_info[:2] != (3, 12):
        warnings.append(f"Python {sys.version_info.major}.{sys.version_info.minor} can run the project, but the baseline is 3.12")
    else:
        print("[OK] Python 3.12")

    _check_modules(PYTHON_MODULES, failures)
    if args.full:
        _check_modules(FULL_MODULES, failures)
        if importlib.util.find_spec("playwright") is not None:
            browser_path = _find_playwright_chromium()
            if browser_path:
                print(f"[OK] Playwright Chromium: {browser_path}")
            else:
                failures.append("Playwright Chromium is missing (run python -m playwright install chromium)")

    node_version = _command_version("node")
    if node_version is None:
        failures.append("Node.js was not found; Vite 8 requires Node 20.19+ or 22.12+")
    elif not _node_is_supported(node_version):
        failures.append(f"Unsupported Node.js version: {node_version}; use 20.19+ or 22.12+")
    else:
        print(f"[OK] Node.js {node_version}")

    for command in ("npm", "npx", "ffmpeg"):
        version = _command_version(command)
        if version is None:
            failures.append(f"{command} was not found; install it and add it to PATH")
        else:
            print(f"[OK] {command}: {version}")

    node_projects = (
        PROJECT_ROOT / "web" / "frontend",
        PROJECT_ROOT / "viral-structure-engine" / "remotion",
    )
    for project in node_projects:
        if not (project / "node_modules").is_dir():
            failures.append(f"Node dependencies are missing: {project.relative_to(PROJECT_ROOT)} (run npm ci)")
        else:
            print(f"[OK] Node dependencies: {project.relative_to(PROJECT_ROOT)}")

    env_file = PROJECT_ROOT / "viral-structure-engine" / ".env"
    if not env_file.exists() and not os.getenv("ZHIPU_API_KEY"):
        warnings.append("Engine .env was not found; Web can start, but AI tasks need API keys from Settings")

    for warning in warnings:
        print(f"[WARN] {warning}")
    for failure in failures:
        print(f"[FAIL] {failure}")

    if failures:
        print("\nPreflight failed. On Windows, run .\\setup_windows.ps1 from the project root.")
        return 1
    print("\nPreflight passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
