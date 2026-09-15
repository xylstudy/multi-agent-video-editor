"""Synchronize completed video genes into the user's personal knowledge base."""

import asyncio
import json
import logging
from collections import Counter
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from sqlmodel import Session, select

import vse  # noqa: F401 - expose viral-structure-engine on sys.path
from database import engine
from db_models import Gene, GeneStatus, KnowledgeOwnership

logger = logging.getLogger(__name__)
_gene_locks: dict[int, asyncio.Lock] = {}


def _existing_entry_ids(store, session: Session, gene_id: int, user_id: int) -> list[str]:
    owned_ids = set(session.exec(
        select(KnowledgeOwnership.entry_id).where(KnowledgeOwnership.user_id == user_id)
    ).all())
    return [
        entry.id
        for entry in store.get_all_entries()
        if entry.id in owned_ids
        and (entry.derivation or {}).get("source_gene_id") == gene_id
    ]


def _render_demo_entries(entries: list[dict]) -> dict:
    """Render source clips for personal knowledge, isolating per-entry failures."""
    from render_knowledge_demos import DEMO_OUT_DIR, render_one, render_source_demo

    rendered = 0
    existing = 0
    failed: list[str] = []
    for entry in entries:
        output = DEMO_OUT_DIR / f"{entry['id']}.mp4"
        source_video = Path(entry.get("__source_video_path", ""))
        source_meta = output.with_suffix(output.suffix + ".source.json")
        source_is_current = False
        if source_video.is_file() and source_meta.is_file():
            try:
                metadata = json.loads(source_meta.read_text(encoding="utf-8"))
                source_is_current = (
                    metadata.get("source_video") == str(source_video.resolve())
                    and metadata.get("source_fingerprint")
                    == f"{source_video.stat().st_size}:{source_video.stat().st_mtime_ns}"
                )
            except (OSError, ValueError, TypeError, json.JSONDecodeError):
                source_is_current = False
        if output.is_file() and output.stat().st_size > 0 and (
            source_is_current or not source_video.is_file()
        ):
            existing += 1
            continue
        if source_video.is_file():
            success, info = render_source_demo(entry, source_video, output)
        else:
            success, info = render_one(entry)
        if success:
            rendered += 1
        else:
            logger.warning("knowledge demo render failed: entry=%s error=%s", entry.get("id"), info)
            failed.append(entry.get("id", ""))
    return {
        "demos_rendered": rendered,
        "demos_existing": existing,
        "demos_available": rendered + existing,
        "demo_failures": failed,
    }


def _label(value, *keys: str) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        for key in (*keys, "category", "type", "method", "summary", "description"):
            if value.get(key):
                return str(value[key]).strip()
    return ""


def _local_entries(report: dict, source_filename: str):
    """Build five reusable dimensions from a completed video report."""
    from models.knowledge import KnowledgeEntry, KnowledgeType

    meta = report.get("vlog_meta") or {}
    structure = report.get("raw_structure_analysis") or {}
    shots = report.get("raw_shot_analyses") or []
    structure_type = _label(
        meta.get("structure_type") or structure.get("structure_type")
    ) or "progressive"
    narrative_type = _label(
        meta.get("narrative_type") or structure.get("narrative_type")
    ) or "short-video narrative"
    hook = structure.get("hook_strategy") or {}
    hook_method = _label(meta.get("hook_method") or hook, "method") or "visual impact"
    hook_detail = _label(meta.get("hook_detail") or hook, "detail", "reasoning")
    rhythm = structure.get("rhythm_analysis") or {}
    packaging = structure.get("packaging_analysis") or {}
    emotion = _label(
        meta.get("overall_emotion") or structure.get("overall_emotion")
    ) or "progressive"
    emotion_counts = Counter(str(shot.get("emotion")) for shot in shots if shot.get("emotion"))
    emotion_sequence = [item for item, _ in emotion_counts.most_common(5)]
    techniques = report.get("key_techniques") or structure.get("key_techniques") or []
    source = f"来源：参考视频《{source_filename}》的结构分析"
    shared_tags = list(dict.fromkeys(filter(None, ["vlog", structure_type, narrative_type])))

    return [
        KnowledgeEntry(
            type=KnowledgeType.STRUCTURE_TEMPLATE,
            title=f"{structure_type}结构模板",
            content=(
                f"采用{structure_type}组织内容，以{narrative_type}推进；保持开场、展开、高潮与收束的清晰职责。"
            ),
            structured_data={
                "structure_type": structure_type,
                "narrative_type": narrative_type,
                "script_structure": structure.get("script_structure") or [],
            },
            tags=shared_tags + ["structure"],
            applicable_vlog_types=[narrative_type],
            best_when="需要复刻参考片段的叙事推进方式时。",
            confidence=0.85,
            source_summary=source,
        ),
        KnowledgeEntry(
            type=KnowledgeType.HOOK_TECHNIQUE,
            title=f"{hook_method} Hook",
            content=(
                f"开场使用“{hook_method}”快速建立注意力。"
                f"{hook_detail or '优先把最有辨识度的画面和主题信息放在前三秒。'}"
            ),
            structured_data={"method": hook_method, "detail": hook_detail, **hook},
            tags=shared_tags + ["hook", "opening"],
            applicable_vlog_types=[narrative_type],
            best_when="需要提升前三秒停留率时。",
            confidence=0.82,
            source_summary=source,
        ),
        KnowledgeEntry(
            type=KnowledgeType.RHYTHM_PATTERN,
            title=f"{structure_type}节奏模式",
            content=(
                "沿用参考片段镜头时长与段落密度的变化关系：开场快速建立信息，中段递进展开，高潮后留下收束空间。"
            ),
            structured_data={
                "shot_count": report.get("shot_count") or len(shots),
                "duration": report.get("duration") or 0,
                "rhythm_analysis": rhythm,
            },
            tags=shared_tags + ["rhythm", "shot duration"],
            applicable_vlog_types=[narrative_type],
            best_when="素材需要按照参考片段节拍和镜头密度重新编排时。",
            confidence=0.8,
            source_summary=source,
        ),
        KnowledgeEntry(
            type=KnowledgeType.EMOTION_DESIGN,
            title=f"{emotion}情绪弧线",
            content=(
                f"整体情绪以“{emotion}”为核心，镜头中的主要情绪依次围绕"
                f"{', '.join(emotion_sequence) or emotion}展开，并在高潮段集中强化。"
            ),
            structured_data={
                "overall_emotion": emotion,
                "emotion_distribution": dict(emotion_counts),
                "emotion_arc": meta.get("emotion_arc") or [],
            },
            tags=shared_tags + ["emotion", emotion],
            applicable_vlog_types=[narrative_type],
            best_when="需要让画面顺序形成明确情绪起伏时。",
            confidence=0.78,
            source_summary=source,
        ),
        KnowledgeEntry(
            type=KnowledgeType.PACKAGING_STYLE,
            title=f"{structure_type}包装组合",
            content=(
                "将参考片的转场、字幕、构图和关键剪辑技法作为组合策略使用，让包装服务于段落功能，避免为动效而动效。"
            ),
            structured_data={"packaging_analysis": packaging, "key_techniques": techniques},
            tags=shared_tags + ["packaging", "transition"],
            applicable_vlog_types=[narrative_type],
            best_when="生成方案需要统一字幕、转场和视觉风格时。",
            confidence=0.76,
            source_summary=source,
        ),
    ]


async def extract_gene_knowledge(gene_id: int, user_id: int) -> dict:
    """Extract knowledge once for a gene and keep demo clips source-specific."""
    lock = _gene_locks.setdefault(gene_id, asyncio.Lock())
    async with lock:
        from knowledge.store import KnowledgeStore

        store = KnowledgeStore()
        existing_payloads: list[dict] = []
        with Session(engine) as session:
            gene = session.get(Gene, gene_id)
            if not gene or gene.user_id != user_id:
                raise RuntimeError("gene does not belong to user")
            if gene.status != GeneStatus.DONE or not gene.report_path:
                raise RuntimeError("gene extraction is not complete")
            report_path = Path(gene.report_path)
            if not report_path.is_file():
                raise RuntimeError("gene report is missing")
            existing_ids = _existing_entry_ids(store, session, gene_id, user_id)
            if existing_ids:
                existing_payloads = [
                    entry.to_dict()
                    for entry in store.get_all_entries()
                    if entry.id in set(existing_ids)
                ]
                for payload in existing_payloads:
                    payload["__source_video_path"] = gene.video_path
                existing_result = {
                    "added": 0,
                    "existing": len(existing_ids),
                    "skipped": True,
                    "trace_path": str(report_path.parent / "knowledge_extract_trace.json"),
                }
                report = None
                title = ""
                source_filename = ""
            else:
                existing_result = None
                report = json.loads(report_path.read_text(encoding="utf-8"))
                title = gene.title
                source_filename = gene.source_filename

        if existing_result is not None:
            demo_result = await asyncio.to_thread(_render_demo_entries, existing_payloads)
            return {**existing_result, **demo_result}

        trace_path = report_path.parent / "knowledge_extract_trace.json"
        entries = _local_entries(report, source_filename)
        if not entries:
            raise RuntimeError("gene report contains no reusable knowledge")

        added_ids: list[str] = []
        existing_payloads = []
        with Session(engine) as session:
            existing_ids = _existing_entry_ids(store, session, gene_id, user_id)
            if existing_ids:
                existing_payloads = [
                    entry.to_dict()
                    for entry in store.get_all_entries()
                    if entry.id in set(existing_ids)
                ]
                gene_video = session.get(Gene, gene_id).video_path
                for payload in existing_payloads:
                    payload["__source_video_path"] = gene_video
                existing_result = {
                    "added": 0,
                    "existing": len(existing_ids),
                    "skipped": True,
                    "trace_path": str(trace_path),
                }
            else:
                existing_result = None
                extracted_at = datetime.now().isoformat()
                try:
                    for entry in entries:
                        entry.id = f"k_u{user_id}_{uuid4().hex[:8]}"
                        entry.source_summary = entry.source_summary or f"From gene: {title}"
                        entry.derivation = {
                            "source_gene_id": gene_id,
                            "source_gene_title": title,
                            "source_video": source_filename,
                            "source_user_id": user_id,
                            "extracted_at": extracted_at,
                            "prompt_version": "local-knowledge-v1",
                            "model": "local-rule-engine",
                        }
                        store.add_entry(entry)
                        added_ids.append(entry.id)
                        session.add(KnowledgeOwnership(entry_id=entry.id, user_id=user_id))
                    session.commit()
                except Exception:
                    session.rollback()
                    for entry_id in added_ids:
                        store.remove_entry(entry_id)
                    raise

        if existing_result is not None:
            demo_result = await asyncio.to_thread(_render_demo_entries, existing_payloads)
            return {**existing_result, **demo_result}

        trace_path.write_text(
            json.dumps(
                {
                    "prompt_version": "local-knowledge-v1",
                    "model": "local-rule-engine",
                    "entry_count": len(entries),
                    "entries": [entry.to_dict() for entry in entries],
                    "created_at": datetime.now().isoformat(),
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        with Session(engine) as session:
            source_gene = session.get(Gene, gene_id)
            source_video_path = source_gene.video_path if source_gene else ""
        demo_entries = [entry.to_dict() for entry in entries]
        for payload in demo_entries:
            payload["__source_video_path"] = source_video_path
        demo_result = await asyncio.to_thread(_render_demo_entries, demo_entries)
        return {
            "added": len(added_ids),
            "existing": 0,
            "skipped": False,
            "trace_path": str(trace_path),
            **demo_result,
        }


async def reconcile_gene_knowledge() -> int:
    """Backfill personal knowledge for completed genes from older versions."""
    with Session(engine) as session:
        candidates = [
            (gene.id, gene.user_id)
            for gene in session.exec(
                select(Gene).where(Gene.status == GeneStatus.DONE).order_by(Gene.id)
            ).all()
            if gene.id is not None
        ]

    added = 0
    for gene_id, user_id in candidates:
        try:
            result = await extract_gene_knowledge(gene_id, user_id)
            added += int(result.get("added") or 0)
        except Exception as exc:
            logger.warning("historical gene knowledge backfill failed: gene=%s error=%s", gene_id, exc)
    return added
