from pathlib import Path

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from auth import get_current_user
from database import get_session
from db_models import Project, Task, TaskStatus, TaskType, User

router = APIRouter(prefix="/api/works", tags=["works"])


@router.get("")
def list_works(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """聚合当前用户所有端到端成功任务的成片。"""
    projects = session.exec(
        select(Project).where(Project.user_id == current_user.id)
    ).all()
    project_map = {p.id: p for p in projects}
    if not project_map:
        return []

    tasks = session.exec(
        select(Task)
        .where(Task.project_id.in_(project_map.keys()))
        .where(Task.status == TaskStatus.SUCCESS)
        .where(Task.type == TaskType.END_TO_END)
        .order_by(Task.id.desc())
    ).all()

    works = []
    for t in tasks:
        if not t.result_path:
            continue
        path = Path(t.result_path)
        if not path.exists() or path.suffix.lower() != ".mp4":
            continue
        project = project_map.get(t.project_id)
        works.append({
            "task_id": t.id,
            "project_id": t.project_id,
            "project_name": project.name if project else "",
            "pipeline_mode": project.pipeline_mode.value if project else "",
            "size_mb": round(path.stat().st_size / 1024 / 1024, 1),
            "created_at": t.updated_at,
        })
    return works
