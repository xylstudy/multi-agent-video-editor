"""视频基因提取后台执行器。

与任务队列解耦：基因提取是独立动作，直接在后台 asyncio 任务中执行，
状态写回 Gene 记录（pending → analyzing → done / failed），前端轮询状态即可。

任务登记在 _extraction_tasks 中，删除基因时可通过 cancel_gene_extraction
杀子进程 + 取消 asyncio 任务，避免孤儿进程继续烧 API 额度。
"""
import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

from sqlmodel import Session

from database import engine
from db_models import Gene, GeneStatus
from pipeline_runner import (
    _get_effective_api_keys,
    kill_active_process,
    run_command,
    setup_api_keys_for_user,
)
from vse import VSE_DIR

logger = logging.getLogger(__name__)

# gene_id -> 正在运行的提取任务
_extraction_tasks: dict[int, asyncio.Task] = {}


def start_gene_extraction(gene_id: int, user_id: int):
    """启动基因提取并登记任务，供取消时使用。"""
    task = asyncio.create_task(run_gene_extraction(gene_id, user_id))
    _extraction_tasks[gene_id] = task
    task.add_done_callback(lambda _: _extraction_tasks.pop(gene_id, None))


def cancel_gene_extraction(gene_id: int):
    """取消正在进行的基因提取：先杀子进程，再取消 asyncio 任务。"""
    kill_active_process(f"gene_{gene_id}")
    task = _extraction_tasks.pop(gene_id, None)
    if task and not task.done():
        task.cancel()
        logger.info(f"已取消基因提取任务: gene_id={gene_id}")


def _noop_progress(step: str, message: str, percent: int):
    logger.info(f"[gene][{step}] {message}")


async def run_gene_extraction(gene_id: int, user_id: int):
    with Session(engine) as session:
        gene = session.get(Gene, gene_id)
        if not gene:
            logger.warning(f"Gene {gene_id} 不存在，取消提取")
            return
        gene.status = GeneStatus.ANALYZING
        gene.error_message = None
        session.add(gene)
        session.commit()
        video_path = gene.video_path
        report_path = Path(gene.video_path).parent / "report.json"

    try:
        # 用户 API Key 覆盖 + 预检
        setup_api_keys_for_user(user_id)
        effective_keys = _get_effective_api_keys(user_id)
        if not effective_keys.get("ZHIPU_API_KEY"):
            raise RuntimeError(
                "未配置 ZHIPU_API_KEY。请在「设置」页面上传智谱 API Key，"
                "或由管理员在 viral-structure-engine/.env 中配置。"
            )

        await run_command(
            [
                sys.executable,
                "analyze_video.py",
                "--video",
                str(Path(video_path).resolve()),
                "--output",
                str(report_path),
            ],
            cwd=VSE_DIR,
            emit_progress=_noop_progress,
            step="gene_extraction",
            start_percent=0,
            end_percent=100,
            proc_key=f"gene_{gene_id}",
        )

        report = json.loads(Path(report_path).read_text(encoding="utf-8"))
        vlog_meta = report.get("vlog_meta") or {}

        with Session(engine) as session:
            gene = session.get(Gene, gene_id)
            gene.status = GeneStatus.DONE
            gene.report_path = str(report_path)
            gene.duration = report.get("duration") or 0.0
            gene.shot_count = report.get("shot_count") or 0
            gene.structure_type = vlog_meta.get("structure_type") or ""
            gene.narrative_type = vlog_meta.get("narrative_type") or ""
            gene.overall_emotion = vlog_meta.get("overall_emotion") or ""
            gene.hook_method = vlog_meta.get("hook_method") or ""
            session.add(gene)
            session.commit()
        logger.info(f"Gene {gene_id} 提取完成: {gene.shot_count} 个镜头")

    except Exception as e:
        logger.exception(f"Gene {gene_id} 提取失败: {e}")
        with Session(engine) as session:
            gene = session.get(Gene, gene_id)
            if gene:
                gene.status = GeneStatus.FAILED
                gene.error_message = str(e)
                session.add(gene)
                session.commit()
