"""方案生成：DeepSeek 基于视频结构 + 素材库生成分镜方案"""
import asyncio
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

from config.llm_client import LLMTools
from config import settings
from config.output_manager import OutputManager
from agents.planner import PlannerAgent


async def main():
    target_topic = "北京旅行Vlog"
    run_id = "scheme_generation_v3"
    out = OutputManager(run_id=run_id)
    logger.info(f"输出目录: {out.run_dir}")

    # DeepSeek：文本处理
    llm = LLMTools(
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
        model="deepseek-chat",
    )
    planner = PlannerAgent(llm)

    # ===== 1. 加载视频结构分析结果 =====
    logger.info("=" * 60)
    logger.info("1. 加载视频结构")
    video_struct_path = Path("data/runs/video_analysis_demo/analyst/video_structure.json")
    if not video_struct_path.exists():
        logger.error(f"找不到视频结构文件: {video_struct_path}")
        return
    video_structure = json.loads(video_struct_path.read_text(encoding="utf-8"))
    structure_summary = json.dumps(video_structure, ensure_ascii=False)
    logger.info(f"   视频长度: {video_structure.get('duration', 0):.1f}s, "
                f"镜头数: {len(video_structure.get('shots', []))}")

    # 加载结构分析（5段式结构、节奏、包装等）
    struct_analysis_path = Path("data/runs/video_analysis_demo/analyst/structure_analysis.json")
    structure_analysis = ""
    if struct_analysis_path.exists():
        structure_analysis = struct_analysis_path.read_text(encoding="utf-8")
        sa = json.loads(structure_analysis)
        acts = sa.get("script_structure", [])
        rhythm = sa.get("rhythm_analysis", {})
        logger.info(f"   结构分析: {len(acts)} 个段落, 节奏模式: {rhythm.get('pattern', '?')}, "
                    f"高潮位置: {rhythm.get('climax_position_percent', '?')}%")

    # ===== 2. 加载素材库存（用户照片 + 爆款视频片段） =====
    logger.info("=" * 60)
    logger.info("2. 加载素材库存")
    inv_path = Path("data/runs/material_analysis/material/inventory.json")
    if not inv_path.exists():
        logger.error(f"找不到素材库存: {inv_path}")
        return
    inventory = json.loads(inv_path.read_text(encoding="utf-8"))
    items = inventory.get("items", inventory.get("materials", []))
    logger.info(f"   用户照片素材: {len(items)}")

    # 合并爆款视频片段
    viral_inv_path = Path("data/runs/viral_clips/viral/inventory.json")
    viral_items = []
    if viral_inv_path.exists():
        viral_inv = json.loads(viral_inv_path.read_text(encoding="utf-8"))
        viral_items = viral_inv.get("items", [])
        logger.info(f"   爆款视频片段: {len(viral_items)}")
        # 合并到 inventory
        all_items = items + viral_items
        inventory["items"] = all_items
        inventory["materials"] = all_items
    else:
        logger.warning("   未找到爆款视频片段素材，仅使用用户照片")

    logger.info(f"   总计素材: {len(inventory.get('items', []))}")

    # ===== 3. 提取结构骨架 =====
    logger.info("=" * 60)
    logger.info("3. 提取结构骨架 (DeepSeek)...")
    skeleton = await planner._extract_skeleton(
        structure_summary, target_topic, "",
        structure_analysis=structure_analysis,
    )
    out.save_json("planner", "skeleton.json", skeleton)
    logger.info(f"   结构类型: {skeleton.get('structure_type', '?')}")
    logger.info(f"   叙事类型: {skeleton.get('narrative_type', '?')}")

    # ===== 4. 生成完整方案（带节奏引导 + 混合素材） =====
    logger.info("=" * 60)
    logger.info("4. 生成完整方案 (DeepSeek)...")

    # 构建素材类型提示
    viral_count = len(viral_items)
    material_type_hint = ""
    if viral_count > 0:
        viral_desc = "\n".join(
            f"  - {v['id']}: {v.get('description', '')[:50]} ({v['duration']:.1f}s, 情绪:{v.get('emotion_label', '')})"
            for v in viral_items
        )
        material_type_hint = (
            f"可用 {len(items)} 张图片素材 + {viral_count} 段爆款视频片段。\n"
            f"视频片段来自原爆款Vlog，可直接使用:\n{viral_desc}\n"
            f"图片素材需要做 Ken Burns 运镜。高潮段落优先用视频片段。"
        )

    preferences = json.dumps({
        "style": "旅行Vlog",
        "shot_count_target": "14-18个分镜",
        "total_duration_guide": "35-45秒",
        "material_usage": "尽量多用不同的素材，避免重复。混合使用视频片段（原爆款Vlog）和用户照片。高潮段落优先用视频片段。",
        "rhythm_structure": [
            {"section": "开场抓眼球", "shot_types": ["hook"], "duration_range": "3-4s", "emotion": "期待/震撼"},
            {"section": "场景进入", "shot_types": ["scene_establish", "scene_establish"], "duration_range": "2-3s", "emotion": "兴奋"},
            {"section": "日常探索", "shot_types": ["daily_moment", "daily_moment", "daily_moment"], "duration_range": "2-3s", "emotion": "轻松愉快"},
            {"section": "节奏放缓", "shot_types": ["daily_moment", "daily_moment"], "duration_range": "3-4s", "emotion": "温暖"},
            {"section": "情绪高潮", "shot_types": ["emotion_peak", "emotion_peak", "emotion_peak"], "duration_range": "3-5s", "emotion": "震撼/感动"},
            {"section": "回落过渡", "shot_types": ["daily_moment"], "duration_range": "3-4s", "emotion": "宁静"},
            {"section": "余韵收尾", "shot_types": ["closing_moment"], "duration_range": "3-4s", "emotion": "满足/回味"},
        ],
        "note": "方案需要有起承转合的节奏感。高潮段用夜景/远景点燃情绪，收尾用夕阳/暮色留下余韵。每个分镜使用不同的素材，充分展示北京的多样性。"
    }, ensure_ascii=False)

    scheme_data = await planner._generate_scheme(
        json.dumps(skeleton, ensure_ascii=False),
        json.dumps(inventory, ensure_ascii=False),
        target_topic, "", preferences,
        material_type_hint=material_type_hint,
    )
    out.save_json("planner", "scheme_raw.json", scheme_data)

    # ===== 5. 构建 VideoScheme 对象 =====
    logger.info("=" * 60)
    logger.info("5. 构建方案...")
    scheme = planner.build_scheme(scheme_data, target_topic, iteration=0)
    out.save_json("planner", "scheme.json", scheme)
    logger.info(f"   标题: {scheme.title}")
    logger.info(f"   目标时长: {scheme.target_duration}s")
    logger.info(f"   分镜数: {len(scheme.storyboard)}")

    # 打印分镜概览
    logger.info("=" * 60)
    logger.info("分镜列表:")
    for f in scheme.storyboard:
        shot_type = f.shot_type.value if hasattr(f.shot_type, 'value') else f.shot_type
        logger.info(f"   [{f.index}] {shot_type:20s} | {f.duration:.1f}s | {f.visual_content[:40]}")
        if f.material_id:
            logger.info(f"         素材: {f.material_id}")

    logger.info(f"\n方案已保存至: {out.run_dir / 'planner'}")


if __name__ == "__main__":
    asyncio.run(main())
