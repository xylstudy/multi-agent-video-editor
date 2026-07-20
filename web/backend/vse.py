"""viral-structure-engine 路径与环境公共配置。

所有需要触达引擎目录（读 .env、调知识库、跑脚本）的模块统一从这里取路径，
避免各自重复 sys.path 处理导致的导入顺序依赖。
"""
import sys
from pathlib import Path

VSE_DIR = Path(__file__).resolve().parent.parent.parent / "viral-structure-engine"
if str(VSE_DIR) not in sys.path:
    sys.path.insert(0, str(VSE_DIR))

VSE_DATA_DIR = VSE_DIR / "data"
VSE_TEMP_DIR = VSE_DATA_DIR / "temp"
VSE_RUNS_DIR = VSE_DATA_DIR / "runs"
VSE_KNOWLEDGE_DB = VSE_DATA_DIR / "knowledge_db" / "knowledge.json"

# 项目根目录 videos/ 下随仓库分发的示例爆款视频（用于「示例基因」一键体验）
REPO_VIDEOS_DIR = VSE_DIR.parent / "videos"
SAMPLE_VIRAL_VIDEO = REPO_VIDEOS_DIR / "北京旅行Vlog _ 漫步京城.mp4"
