from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select

import vse  # noqa: F401  注入 viral-structure-engine 路径
from app_config import STORAGE_ROOT
from auth import get_current_user
from database import get_session
from db_models import KnowledgeOwnership, User
from media import get_current_user_media, range_file_response

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])

DEMO_DIR = STORAGE_ROOT / "knowledge_demos"


def _demo_path(entry_id: str) -> Path:
    # entry_id 由系统生成（形如 k_0），仍做一层防路径穿越校验
    safe = Path(entry_id).name
    return DEMO_DIR / f"{safe}.mp4"


def _load_store():
    """每次请求重新加载，保证提炼入库的新知识立即可见。"""
    from knowledge.store import KnowledgeStore

    return KnowledgeStore()


def _ownership_map(session: Session) -> dict[str, int]:
    """知识条目归属：entry_id -> user_id。无记录的条目 = 公共种子，全员可见。"""
    return {o.entry_id: o.user_id for o in session.exec(select(KnowledgeOwnership)).all()}


def _is_visible(entry_id: str, ownership: dict[str, int], user_id: int) -> bool:
    """公共（无归属记录）或本人提炼的知识可见；他人私有知识表现为不存在。"""
    owner = ownership.get(entry_id)
    return owner is None or owner == user_id


@router.get("")
def list_knowledge(
    type: str | None = None,
    q: str | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    store = _load_store()
    ownership = _ownership_map(session)
    entries = [
        {**e.to_dict(), "mine": ownership.get(e.id) == current_user.id}
        for e in store.get_all_entries()
        if _is_visible(e.id, ownership, current_user.id)
    ]

    if type:
        entries = [e for e in entries if e["type"] == type]
    if q:
        keyword = q.strip().lower()
        entries = [
            e
            for e in entries
            if keyword in e["title"].lower()
            or keyword in e["content"].lower()
            or any(keyword in str(t).lower() for t in e["tags"])
        ]
    # 标记每个条目是否有演示视频
    for e in entries:
        e["has_demo"] = _demo_path(e["id"]).exists()
    return entries


@router.get("/stats")
def knowledge_stats(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    store = _load_store()
    ownership = _ownership_map(session)
    counts: dict[str, int] = {}
    total = 0
    for e in store.get_all_entries():
        if not _is_visible(e.id, ownership, current_user.id):
            continue
        total += 1
        key = e.type.value
        counts[key] = counts.get(key, 0) + 1
    return {"total": total, "by_type": counts}


@router.get("/{entry_id}/demo")
def get_knowledge_demo(
    entry_id: str,
    request: Request,
    current_user: User = Depends(get_current_user_media),
):
    """知识条目的技法演示视频（支持 Range 拖动播放）。"""
    path = _demo_path(entry_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="该知识暂无演示视频")
    return range_file_response(request, path, media_type="video/mp4")


@router.delete("/{entry_id}", status_code=204)
def delete_knowledge(
    entry_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    store = _load_store()
    if not store.get_entry(entry_id):
        raise HTTPException(status_code=404, detail="知识条目不存在")
    owner = _ownership_map(session).get(entry_id)
    if owner is not None and owner != current_user.id:
        # 他人私有知识：不泄露存在性
        raise HTTPException(status_code=404, detail="知识条目不存在")
    if owner is None:
        raise HTTPException(status_code=403, detail="公共知识不可删除")
    store.remove_entry(entry_id)
    row = session.get(KnowledgeOwnership, entry_id)
    if row:
        session.delete(row)
        session.commit()
    # 同步清理演示视频
    _demo_path(entry_id).unlink(missing_ok=True)
    return None
