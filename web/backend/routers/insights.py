"""统计洞察 API — 跨视频挖掘结果 + 自包含 HTML 报告。

数据边界：扫描引擎共享目录（示例/种子级分析）+ 当前用户自己的基因存储目录，
不触碰其他用户的私有报告（与项目/基因隔离策略一致）。
"""
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse

import vse  # noqa: F401  注入 viral-structure-engine 路径
from app_config import STORAGE_ROOT
from auth import get_current_user
from db_models import User
from media import get_current_user_media

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/insights", tags=["insights"])


def _scan_roots(user_id: int) -> list:
    """引擎共享目录 + 当前用户私有目录。"""
    from pathlib import Path

    roots = [
        vse.VSE_RUNS_DIR,
        vse.VSE_DATA_DIR / "output",
        vse.VSE_DIR.parent / "data",  # 项目根 data/output（CLI 默认输出）
        STORAGE_ROOT / "users" / str(user_id),
    ]
    return [r for r in roots if r.exists()]


def _run_mining(user_id: int):
    from knowledge.insight_miner import InsightMiner, discover_analyses
    from insight_report import generate_report

    videos = discover_analyses(_scan_roots(user_id))
    if not videos:
        return None, None
    mined = InsightMiner(videos).mine()
    report_path = vse.VSE_TEMP_DIR / f"insight_report_u{user_id}.html"
    generate_report(mined, videos, report_path)
    return mined, report_path


@router.get("")
def get_insights(current_user: User = Depends(get_current_user)):
    """挖掘结果 JSON（洞察列表 + 样本信息）。"""
    mined, _ = _run_mining(current_user.id)
    if mined is None:
        return {"sample_size": 0, "videos": [], "insights": [], "generated_at": ""}
    return mined


@router.get("/report", response_class=HTMLResponse)
def get_insights_report(current_user: User = Depends(get_current_user_media)):
    """自包含 HTML 洞察报告（iframe 嵌入用，支持 ?token= 鉴权）。

    每次请求实时重新挖掘，保证新分析的视频立即出现在报告里。
    """
    mined, report_path = _run_mining(current_user.id)
    if mined is None or report_path is None:
        return HTMLResponse(
            "<html><body style='font-family:sans-serif;padding:40px;color:#888'>"
            "暂无可分析的报告——请先在基因库中分析至少一个视频。</body></html>"
        )
    return HTMLResponse(report_path.read_text(encoding="utf-8"))
