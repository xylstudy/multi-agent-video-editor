from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session

import vse  # noqa: F401  注入 viral-structure-engine 路径
from app_config import STORAGE_ROOT
from auth import get_current_user
from db_models import User
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


@router.get("")
def list_knowledge(
    type: str | None = None,
    q: str | None = None,
    current_user: User = Depends(get_current_user),
):
    store = _load_store()
    entries = [e.to_dict() for e in store.get_all_entries()]

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
def knowledge_stats(current_user: User = Depends(get_current_user)):
    store = _load_store()
    counts: dict[str, int] = {}
    for e in store.get_all_entries():
        key = e.type.value
        counts[key] = counts.get(key, 0) + 1
    return {"total": store.count(), "by_type": counts}


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
):
    store = _load_store()
    if not store.get_entry(entry_id):
        raise HTTPException(status_code=404, detail="知识条目不存在")
    store.remove_entry(entry_id)
    # 同步清理演示视频
    _demo_path(entry_id).unlink(missing_ok=True)
    return None
