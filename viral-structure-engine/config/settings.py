import os
from pathlib import Path

from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

ROOT_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = ROOT_DIR / "data"
SAMPLES_DIR = DATA_DIR / "samples"
ASSETS_DIR = DATA_DIR / "assets"
OUTPUT_DIR = DATA_DIR / "output"
TEMP_DIR = DATA_DIR / "temp"
KNOWLEDGE_DB_DIR = DATA_DIR / "knowledge_db"

RUNS_DIR = DATA_DIR / "runs"

TEMP_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
KNOWLEDGE_DB_DIR.mkdir(parents=True, exist_ok=True)
RUNS_DIR.mkdir(parents=True, exist_ok=True)

DOMAIN = "vlog"

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

MOONSHOT_API_KEY = os.getenv("MOONSHOT_API_KEY", "")
MOONSHOT_BASE_URL = os.getenv("MOONSHOT_BASE_URL", "https://api.moonshot.cn/v1")

ZHIPU_API_KEY = os.getenv("ZHIPU_API_KEY", "")
ZHIPU_BASE_URL = os.getenv("ZHIPU_BASE_URL", "https://open.bigmodel.cn/api/paas/v4")

LLM_MAX_RETRIES = 3
LLM_TIMEOUT = 180

SCENE_CHANGE_THRESHOLD = 0.3
KEYFRAME_INTERVAL = 2.0

DEFAULT_VLOG_DURATION = 60
MAX_ITERATIONS = 3

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
