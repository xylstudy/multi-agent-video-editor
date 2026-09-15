"""Keep completed task analyses in sync with the user's video gene library.

The task pipeline writes its mutable artifacts below ``projects/.../tasks`` while
the gene library and insight miner deliberately read only ``users/.../genes``.
This module is the bridge between those two ownership-scoped stores.
"""
import json
import hashlib
import logging
import shutil
from datetime import datetime
from pathlib import Path

from sqlmodel import Session, select

from app_config import STORAGE_ROOT
from database import engine
from db_models import Gene, GeneStatus, Material, MaterialType, Project, Task, TaskStatus, TaskType

logger = logging.getLogger(__name__)


def _safe_filename(filename: str) -> str:
    safe_name = Path(filename or "reference.mp4").name
    for char in '\\/:*?"<>|':
        safe_name = safe_name.replace(char, "_")
    return safe_name or "reference.mp4"


def _summary_value(value) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return str(value.get("category") or value.get("type") or value.get("method") or "")
    return ""


def _read_complete_report(report_path: Path) -> dict | None:
    if not report_path.is_file():
        return None
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(report.get("raw_shot_analyses"), list):
        return None
    if not isinstance(report.get("raw_structure_analysis"), dict):
        return None
    if not report["raw_shot_analyses"] or not report["raw_structure_analysis"]:
        return None
    return report


def _file_fingerprint(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _files_match(first: Path, second: Path) -> bool:
    try:
        first = Path(first)
        second = Path(second)
        if not first.is_file() or not second.is_file():
            return False
        if first.stat().st_size != second.stat().st_size:
            return False
        return _file_fingerprint(first) == _file_fingerprint(second)
    except OSError:
        return False


def sync_task_reference_gene(
    *,
    task_id: int,
    project_id: int,
    user_id: int,
    video: Material,
    report_path: Path,
    db_engine=None,
    storage_root: Path | None = None,
) -> int | None:
    """Persist one task's completed reference analysis as a user-owned Gene.

    The project-to-gene link makes this operation idempotent. If the project was
    created from an existing gene, that gene is retained and no duplicate is
    created. Reports, video and frames are copied so deleting the project cannot
    break the gene library later.
    """
    report_path = Path(report_path)
    report = _read_complete_report(report_path)
    if report is None:
        return None
    source_video = Path(video.storage_path)
    if not source_video.is_file():
        raise FileNotFoundError(f"reference video does not exist: {source_video}")
    report_fingerprint = report.get("source_fingerprint")
    if report_fingerprint and report_fingerprint != _file_fingerprint(source_video):
        raise ValueError("analysis report does not belong to the current reference video")

    active_engine = db_engine or engine
    active_storage = Path(storage_root or STORAGE_ROOT)
    gene_dir: Path | None = None
    created_new = False

    with Session(active_engine) as session:
        project = session.get(Project, project_id)
        if not project or project.user_id != user_id:
            raise ValueError("Project does not belong to the task user")

        gene = session.get(Gene, project.gene_id) if project.gene_id is not None else None
        if (
            gene
            and gene.user_id == user_id
            and gene.status == GeneStatus.DONE
            and _files_match(Path(gene.video_path), Path(video.storage_path))
        ):
            return gene.id
        # A completed gene with different bytes is an older reference video.
        # Keep it in the library, but create a new gene for this project run.
        if gene and gene.status == GeneStatus.DONE and gene.user_id == user_id:
            gene = None
        if not gene or gene.user_id != user_id:
            gene = Gene(
                user_id=user_id,
                title=Path(video.filename or "参考视频").stem or "参考视频",
                status=GeneStatus.PENDING,
            )
            session.add(gene)
            session.flush()
            created_new = True

        gene_dir = active_storage / "users" / str(user_id) / "genes" / str(gene.id)
        gene_dir.mkdir(parents=True, exist_ok=True)
        source_video = Path(video.storage_path)
        if not source_video.is_file():
            raise FileNotFoundError(f"参考视频不存在: {source_video}")

        video_dest = gene_dir / _safe_filename(video.filename)
        if source_video.resolve() != video_dest.resolve():
            shutil.copy2(source_video, video_dest)

        # Make the library artifact self-contained instead of retaining a path
        # into a project that the user may delete later.
        stored_report = dict(report)
        stored_report["source_path"] = str(video_dest.resolve())
        stored_report["source_fingerprint"] = _file_fingerprint(source_video)
        report_dest = gene_dir / "report.json"
        report_dest.write_text(
            json.dumps(stored_report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        trace_source = report_path.parent / "analysis_trace.json"
        if trace_source.is_file():
            shutil.copy2(trace_source, gene_dir / "analysis_trace.json")
        frames_source = report_path.parent / "frames"
        if frames_source.is_dir():
            shutil.copytree(frames_source, gene_dir / "frames", dirs_exist_ok=True)

        meta = report.get("vlog_meta") or {}
        structure = report.get("raw_structure_analysis") or {}
        gene.status = GeneStatus.DONE
        gene.source_filename = video.filename or video_dest.name
        gene.video_path = str(video_dest)
        gene.report_path = str(report_dest)
        gene.error_message = None
        gene.progress = 100
        gene.progress_logs = [
            *(gene.progress_logs or []),
            {
                "time": datetime.utcnow().isoformat(),
                "type": "task_sync",
                "message": f"已从项目任务 #{task_id} 同步到基因库",
                "percent": 100,
                "data": {"task_id": task_id, "project_id": project_id},
            },
        ][-300:]
        gene.duration = float(report.get("duration") or 0.0)
        gene.shot_count = int(report.get("shot_count") or len(report.get("raw_shot_analyses") or []))
        gene.structure_type = _summary_value(meta.get("structure_type") or structure.get("structure_type"))
        gene.narrative_type = _summary_value(meta.get("narrative_type") or structure.get("narrative_type"))
        gene.overall_emotion = _summary_value(meta.get("overall_emotion") or structure.get("overall_emotion"))
        gene.hook_method = _summary_value(meta.get("hook_method") or structure.get("hook_strategy"))
        project.gene_id = gene.id
        session.add(gene)
        session.add(project)
        try:
            session.commit()
        except Exception:
            session.rollback()
            if created_new and gene_dir.exists():
                shutil.rmtree(gene_dir, ignore_errors=True)
            raise

        logger.info(
            "任务分析已同步到基因库: user=%s project=%s task=%s gene=%s",
            user_id,
            project_id,
            task_id,
            gene.id,
        )
        return gene.id


def reconcile_completed_task_genes() -> int:
    """Backfill reports produced before task-to-gene synchronization existed."""
    candidates: list[tuple[int, int, int, Material, Path]] = []
    with Session(engine) as session:
        tasks = session.exec(select(Task).order_by(Task.id.desc())).all()
        for task in tasks:
            if task.status not in (TaskStatus.SUCCESS, TaskStatus.AWAITING_CONFIRMATION):
                continue
            if task.type not in (TaskType.ANALYZE_VIDEO, TaskType.END_TO_END):
                continue
            project = session.get(Project, task.project_id)
            if not project:
                continue
            linked = session.get(Gene, project.gene_id) if project.gene_id is not None else None
            if linked and linked.user_id == project.user_id and linked.status == GeneStatus.DONE:
                continue
            video = session.exec(
                select(Material).where(
                    Material.project_id == project.id,
                    Material.type == MaterialType.VIDEO,
                )
            ).first()
            if not video:
                continue
            report_path = (
                STORAGE_ROOT
                / "users"
                / str(project.user_id)
                / "projects"
                / str(project.id)
                / "tasks"
                / str(task.id)
                / "analysis"
                / "reference_report.json"
            )
            if _read_complete_report(report_path) is not None:
                candidates.append((task.id, project.id, project.user_id, video, report_path))

    synced = 0
    for task_id, project_id, user_id, video, report_path in candidates:
        try:
            if sync_task_reference_gene(
                task_id=task_id,
                project_id=project_id,
                user_id=user_id,
                video=video,
                report_path=report_path,
            ) is not None:
                synced += 1
        except Exception:
            logger.exception("历史任务基因回填失败: task=%s", task_id)
    return synced
