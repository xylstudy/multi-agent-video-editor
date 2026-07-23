from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from auth import get_current_user
from database import get_session
from db_models import Gene, KnowledgeOwnership, Project, Task, User
from vse import VSE_KNOWLEDGE_DB

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _knowledge_count(session: Session, user_id: int) -> int:
    """当前用户可见的知识条数：公共种子（无归属记录）+ 本人提炼的。"""
    import json

    if not VSE_KNOWLEDGE_DB.exists():
        return 0
    try:
        entries = json.loads(VSE_KNOWLEDGE_DB.read_text(encoding="utf-8"))
    except Exception:
        return 0
    ownership = {o.entry_id: o.user_id for o in session.exec(select(KnowledgeOwnership)).all()}
    return sum(
        1 for e in entries
        if ownership.get(e.get("id", "")) in (None, user_id)
    )


@router.get("")
def get_stats(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    projects = session.exec(
        select(Project).where(Project.user_id == current_user.id)
    ).all()
    project_ids = [p.id for p in projects]

    gene_count = session.exec(
        select(func.count(Gene.id)).where(Gene.user_id == current_user.id)
    ).one()

    recent_tasks = []
    works_count = 0
    if project_ids:
        tasks = session.exec(
            select(Task)
            .where(Task.project_id.in_(project_ids))
            .order_by(Task.id.desc())
            .limit(6)
        ).all()
        project_map = {p.id: p.name for p in projects}
        recent_tasks = [
            {
                "id": t.id,
                "project_id": t.project_id,
                "project_name": project_map.get(t.project_id, ""),
                "type": t.type.value,
                "status": t.status.value,
                "progress": t.progress,
                "updated_at": t.updated_at,
            }
            for t in tasks
        ]
        works_count = session.exec(
            select(func.count(Task.id))
            .where(Task.project_id.in_(project_ids))
            .where(Task.status == "success")
            .where(Task.type == "end_to_end")
        ).one()

    return {
        "projects": len(projects),
        "genes": gene_count,
        "knowledge": _knowledge_count(session, current_user.id),
        "works": works_count,
        "recent_tasks": recent_tasks,
    }
