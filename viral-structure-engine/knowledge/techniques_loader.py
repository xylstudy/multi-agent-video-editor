"""剪辑手法注册表加载器 — 将 editing_techniques.json 加载为 KnowledgeEntry 列表。

供 Pipeline 和 Agent 引用，也可通过 KnowledgeStore.seed_from_registry() 持久化。
"""
import json
from pathlib import Path
from typing import Optional

from models.knowledge import KnowledgeEntry, KnowledgeType


_TECHNIQUES_PATH = Path(__file__).resolve().parent / "editing_techniques.json"


def load_registry() -> dict:
    """加载原始 JSON 注册表"""
    return json.loads(_TECHNIQUES_PATH.read_text(encoding="utf-8"))


def registry_to_entries(
    registry: Optional[dict] = None,
) -> list[KnowledgeEntry]:
    """将注册表扁平化为 KnowledgeEntry 列表，可存入 KnowledgeStore"""
    reg = registry or load_registry()
    entries: list[KnowledgeEntry] = []

    # 转场
    for tid, tdata in reg.get("transitions", {}).items():
        entries.append(KnowledgeEntry(
            type=KnowledgeType.TRANSITION_TYPE,
            title=tdata["name"],
            content=tdata.get("name_en", ""),
            structured_data={
                "id": tid,
                "suitability": tdata.get("suitability", {}),
                "best_for": tdata.get("best_for", []),
                "duration_hint_frames": tdata.get("duration_hint_frames", 0),
            },
            tags=["transition", tid] + tdata.get("best_for", []),
            applicable_vlog_types=["travel", "daily", "city", "cinematic"],
            confidence=0.9,
            source_summary="抖音旅行Vlog剪辑手法分析",
        ))

    # 特效
    for eid, edata in reg.get("effects", {}).items():
        entries.append(KnowledgeEntry(
            type=KnowledgeType.EFFECT_TYPE,
            title=edata["name"],
            content=edata.get("description", ""),
            structured_data={
                "id": eid,
                "component": edata.get("component") or edata.get("hook", ""),
                "file": edata.get("file", ""),
                "params": edata.get("params", {}),
            },
            tags=["effect", eid, edata.get("component", "")],
            applicable_vlog_types=["travel", "daily", "city"],
            confidence=0.85,
            source_summary="抖音旅行Vlog剪辑手法分析",
        ))

    # 前景揭示效果
    for fid, fdata in reg.get("foreground_reveal_effects", {}).items():
        entries.append(KnowledgeEntry(
            type=KnowledgeType.EDITING_TECHNIQUE,
            title=fdata["name"],
            content=fdata.get("description", ""),
            structured_data={
                "id": fid,
                "category": "foreground_reveal",
                "duration_hint_frames": fdata.get("duration_hint_frames", 20),
            },
            tags=["foreground_reveal", fid],
            applicable_vlog_types=["travel", "city"],
            confidence=0.8,
            source_summary="前景分割展示效果",
        ))

    # 字幕样式
    for sid, sdata in reg.get("subtitle_styles", {}).items():
        entries.append(KnowledgeEntry(
            type=KnowledgeType.EDITING_TECHNIQUE,
            title=sdata["name"],
            content=sdata.get("description", ""),
            structured_data={
                "id": sid,
                "category": "subtitle_style",
                "animation_type": sdata.get("animation_type", ""),
            },
            tags=["subtitle", sid],
            applicable_vlog_types=["travel", "daily", "city", "cinematic"],
            confidence=0.85,
            source_summary="Vlog字幕样式库",
        ))

    # 风格配置
    for pid, pdata in reg.get("style_profiles", {}).items():
        entries.append(KnowledgeEntry(
            type=KnowledgeType.PACKAGING_STYLE,
            title=pdata["name"],
            content="\n".join(pdata.get("characteristics", [])),
            structured_data={
                "id": pid,
                "recommended_transitions": pdata.get("recommended_transitions", []),
                "recommended_effects": pdata.get("recommended_effects", []),
                "recommended_subtitle_styles": pdata.get("recommended_subtitle_styles", []),
                "bgm_style": pdata.get("bgm_style", ""),
                "hook_strategy": pdata.get("hook_strategy", ""),
            },
            tags=["style_profile", pid] + pdata.get("source_videos", []),
            applicable_vlog_types=["travel"],
            confidence=0.8,
            source_summary="抖音旅行Vlog风格分析",
        ))

    # 关键技法
    for kt in reg.get("key_techniques_from_analysis", []):
        entries.append(KnowledgeEntry(
            type=KnowledgeType.EDITING_TECHNIQUE,
            title=kt["technique"],
            content=kt.get("detail", ""),
            structured_data={"source": kt.get("source", "")},
            tags=["key_technique"] + kt.get("source", "").split("、"),
            applicable_vlog_types=["travel"],
            confidence=0.9,
            source_summary="抖音旅行Vlog通用手法",
        ))

    return entries


def seed_store(store, registry: Optional[dict] = None) -> int:
    """将注册表全部写入 KnowledgeStore。返回写入条数。"""
    entries = registry_to_entries(registry)
    for e in entries:
        store.add_entry(e)
    return len(entries)


def get_summary() -> str:
    """生成注册表摘要文本（供 LLM prompt 注入）"""
    reg = load_registry()
    lines = ["【系统可用剪辑手法总览】"]

    lines.append(f"\n## 转场 ({len(reg['transitions'])} 种)")
    for tid, t in reg["transitions"].items():
        lines.append(f"- {t['name']} ({tid}): {', '.join(t['best_for'][:2])}")

    lines.append(f"\n## 特效覆盖层 ({len(reg['effects'])} 种)")
    for eid, e in reg["effects"].items():
        lines.append(f"- {e['name']} ({eid}): {e['description']}")

    lines.append(f"\n## 前景揭示效果 ({len(reg['foreground_reveal_effects'])} 种)")
    for fid, f in reg["foreground_reveal_effects"].items():
        lines.append(f"- {f['name']}: {f['description']}")

    lines.append(f"\n## 字幕样式 ({len(reg['subtitle_styles'])} 种)")
    for sid, s in reg["subtitle_styles"].items():
        lines.append(f"- {s['name']}: {s['description']}")

    lines.append(f"\n## 风格配置 ({len(reg['style_profiles'])} 种)")
    for pid, p in reg["style_profiles"].items():
        lines.append(f"- {p['name']}: {'; '.join(p['characteristics'][:3])}")

    lines.append(f"\n## 镜头-转场映射 ({len(reg['shot_type_transition_mapping'])} 种镜头类型)")
    lines.append(f"## 节奏-转场密度 ({len(reg['scene_rhythm_transition_density'])} 档)")

    return "\n".join(lines)
