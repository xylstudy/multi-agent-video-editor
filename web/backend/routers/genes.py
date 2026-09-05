import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from app_config import STORAGE_ROOT
from auth import get_current_user
from database import get_session
from gene_worker import cancel_gene_extraction, start_gene_extraction
from db_models import Gene, GeneRead, GeneStatus, KnowledgeOwnership, User
from media import get_current_user_media, range_file_response
from vse import SAMPLE_VIRAL_VIDEO

router = APIRouter(prefix="/api/genes", tags=["genes"])


def _get_gene_dir(user_id: int, gene_id: int) -> Path:
    path = STORAGE_ROOT / "users" / str(user_id) / "genes" / str(gene_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _get_owned_gene(gene_id: int, user_id: int, session: Session) -> Gene:
    gene = session.get(Gene, gene_id)
    if not gene or gene.user_id != user_id:
        raise HTTPException(status_code=404, detail="基因不存在")
    return gene


@router.get("", response_model=list[GeneRead])
def list_genes(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    genes = session.exec(
        select(Gene).where(Gene.user_id == current_user.id).order_by(Gene.id.desc())
    ).all()
    return genes


@router.post("", response_model=GeneRead, status_code=status.HTTP_201_CREATED)
async def create_gene(
    title: str = Form(...),
    file: Optional[UploadFile] = File(default=None),
    use_sample: bool = Form(default=False),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not use_sample and (file is None or not file.filename):
        raise HTTPException(status_code=400, detail="请上传参考视频，或选择示例视频")

    gene = Gene(title=title.strip() or "未命名视频", user_id=current_user.id)
    session.add(gene)
    session.commit()
    session.refresh(gene)

    gene_dir = _get_gene_dir(current_user.id, gene.id)

    if use_sample:
        if not SAMPLE_VIRAL_VIDEO.exists():
            raise HTTPException(status_code=404, detail="示例视频文件不存在")
        dest = gene_dir / f"sample{SAMPLE_VIRAL_VIDEO.suffix}"
        shutil.copy2(SAMPLE_VIRAL_VIDEO, dest)
        gene.source_filename = SAMPLE_VIRAL_VIDEO.name
    else:
        safe_name = Path(file.filename).name
        for ch in '\\/:*?"<>|':
            safe_name = safe_name.replace(ch, "_")
        dest = gene_dir / safe_name
        with dest.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        gene.source_filename = safe_name

    gene.video_path = str(dest)
    session.add(gene)
    session.commit()
    session.refresh(gene)

    # 后台异步提取基因
    start_gene_extraction(gene.id, current_user.id)

    return gene


@router.get("/{gene_id}")
def get_gene(
    gene_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    gene = _get_owned_gene(gene_id, current_user.id, session)
    result = GeneRead.model_validate(gene).model_dump()
    report = None
    if gene.status == GeneStatus.DONE and gene.report_path and Path(gene.report_path).exists():
        report = json.loads(Path(gene.report_path).read_text(encoding="utf-8"))
    return {**result, "report": report}


@router.get("/{gene_id}/video")
def get_gene_video(
    gene_id: int,
    request: Request,
    current_user: User = Depends(get_current_user_media),
    session: Session = Depends(get_session),
):
    gene = _get_owned_gene(gene_id, current_user.id, session)
    if not gene.video_path or not Path(gene.video_path).exists():
        raise HTTPException(status_code=404, detail="视频文件不存在")
    return range_file_response(request, gene.video_path, media_type="video/mp4")


@router.get("/{gene_id}/frames/{filename}")
def get_gene_frame(
    gene_id: int,
    filename: str,
    current_user: User = Depends(get_current_user_media),
    session: Session = Depends(get_session),
):
    """提取过程中保存的镜头关键帧缩略图（analyze_video.py 写入 frames/）。"""
    gene = _get_owned_gene(gene_id, current_user.id, session)
    # 防路径穿越：仅允许纯文件名
    if Path(filename).name != filename or ".." in filename:
        raise HTTPException(status_code=400, detail="非法文件名")
    if not gene.video_path:
        raise HTTPException(status_code=404, detail="关键帧不存在")
    frame_path = Path(gene.video_path).parent / "frames" / filename
    if not frame_path.exists():
        raise HTTPException(status_code=404, detail="关键帧不存在")
    return FileResponse(frame_path, media_type="image/jpeg")


@router.delete("/{gene_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_gene(
    gene_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    gene = _get_owned_gene(gene_id, current_user.id, session)
    # 先取消正在运行的提取（杀子进程 + 取消任务），避免孤儿进程继续消耗 API
    cancel_gene_extraction(gene_id)
    gene_dir = STORAGE_ROOT / "users" / str(current_user.id) / "genes" / str(gene.id)
    session.delete(gene)
    session.commit()
    if gene_dir.exists():
        shutil.rmtree(gene_dir, ignore_errors=True)
    return None


@router.post("/{gene_id}/extract-knowledge")
async def extract_knowledge(
    gene_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """从基因报告中提炼知识，写入全局知识库。"""
    gene = _get_owned_gene(gene_id, current_user.id, session)
    if gene.status != GeneStatus.DONE or not gene.report_path:
        raise HTTPException(status_code=400, detail="基因提取尚未完成")
    if not Path(gene.report_path).exists():
        raise HTTPException(status_code=404, detail="报告文件不存在")

    report_text = Path(gene.report_path).read_text(encoding="utf-8")
    # 提炼轨迹写到基因目录，与分析报告、关键帧放在一起
    trace_path = Path(gene.report_path).parent / "knowledge_extract_trace.json"

    try:
        from agents.knowledge_agent import KnowledgeAgent
        from knowledge.store import KnowledgeStore
        from models.trace import KNOWLEDGE_EXTRACT_PROMPT_VERSION

        agent = KnowledgeAgent()
        store = KnowledgeStore()
        entries = await agent.extract_knowledge(
            report_text, "vlog", gene.duration or 0.0, trace_path=trace_path,
        )
        extracted_at = datetime.now().isoformat()
        model = getattr(agent.llm, "model", "")
        for entry in entries:
            # 引擎默认 id 规则（k_序号）会与已有条目冲突，统一换成全局唯一 id
            entry.id = f"k_u{current_user.id}_{uuid4().hex[:8]}"
            entry.source_summary = entry.source_summary or f"来自基因「{gene.title}」"
            # 溯源：这条知识来自哪个基因、用的哪个 prompt/模型
            entry.derivation = {
                "source_gene_id": gene.id,
                "source_gene_title": gene.title,
                "source_video": gene.source_filename,
                "extracted_at": extracted_at,
                "prompt_version": KNOWLEDGE_EXTRACT_PROMPT_VERSION,
                "model": model,
            }
            store.add_entry(entry)
            # 记录归属：个人提炼的知识仅本人可见、可删
            session.add(KnowledgeOwnership(entry_id=entry.id, user_id=current_user.id))
        session.commit()
        return {"added": len(entries), "trace_path": str(trace_path)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"知识提炼失败: {e}")
