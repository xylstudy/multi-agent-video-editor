"""
测试脚本：直接加载已有的 inventory（GLM-4.6V 分析好的素材），
跳过 analyst/material_manager，从 planner 开始执行后续全流程。

目的：验证在 Remotion skill 升级后，系统能否基于图片描述自动编排出好看的视频。

用法：
    python test_inventory_pipeline.py --topic "北京旅行Vlog" --inventory data/output/beijing_inventory.json
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# 确保能找到项目模块
sys.path.insert(0, str(Path(__file__).resolve().parent))

from graph.state import ViralEngineState
from config.output_manager import OutputManager
from config import settings


async def run_inventory_pipeline(
    inventory_path: str,
    target_topic: str,
    max_iterations: int = 3,
):
    # 加载 inventory
    inv_path = Path(inventory_path)
    if not inv_path.exists():
        logger.error(f"Inventory 文件不存在: {inv_path}")
        return

    with open(inv_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    from models.material import MaterialInventory, MaterialItem, MaterialType, MaterialQuality

    quality_map = {"high": MaterialQuality.HIGH, "medium": MaterialQuality.MEDIUM,
                   "low": MaterialQuality.LOW, "unusable": MaterialQuality.UNUSABLE}

    items = []
    for item_data in raw.get("items", []):
        try:
            mtype = MaterialType(item_data.get("type", "image"))
        except ValueError:
            mtype = MaterialType.IMAGE

        item = MaterialItem(
            id=item_data.get("id", ""),
            type=mtype,
            path=item_data.get("path", ""),
            description=item_data.get("description", ""),
            main_subject=item_data.get("main_subject", ""),
            tags=item_data.get("tags", []),
            quality=quality_map.get(item_data.get("quality", "medium"), MaterialQuality.MEDIUM),
            has_face=item_data.get("has_face", False),
            face_count=item_data.get("face_count", 0),
            emotion_label=item_data.get("emotion_label", ""),
            scene_type=item_data.get("scene_type", ""),
            composition=item_data.get("composition", ""),
            light=item_data.get("light", ""),
            resolution=item_data.get("resolution", ""),
        )
        items.append(item)

    inventory = MaterialInventory(items=items)

    # 从素材中提取主题描述
    tags_count = {}
    emotions = []
    scenes = set()
    for item in items:
        for tag in getattr(item, "tags", []):
            tags_count[tag] = tags_count.get(tag, 0) + 1
        if getattr(item, "emotion_label", ""):
            emotions.append(item.emotion_label)
        if getattr(item, "scene_type", ""):
            scenes.add(item.scene_type)

    # 取 Top 标签作为主题信息
    top_tags = sorted(tags_count.items(), key=lambda x: -x[1])[:10]
    tag_summary = ", ".join(f"{t}({c})" for t, c in top_tags)
    emotion_summary = "、".join(set(emotions))

    logger.info("=" * 60)
    logger.info("Inventory Pipeline 测试")
    logger.info(f"主题: {target_topic}")
    logger.info(f"素材数: {len(items)} 张图片")
    logger.info(f"Top 标签: {tag_summary}")
    logger.info(f"情绪分布: {emotion_summary}")
    logger.info("=" * 60)

    # 创建 run_id 和输出目录
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_topic = "".join(c if c.isalnum() else "_" for c in target_topic)[:20]
    run_id = f"{timestamp}_{safe_topic}_inventory_test"
    out = OutputManager(run_id=run_id)

    out.save_run_info(
        test_type="inventory_pipeline",
        target_topic=target_topic,
        inventory_source=str(inv_path),
        materials_count=len(items),
        max_iterations=max_iterations,
    )
    # 保存 inventory 副本
    out.save_json("material", "inventory.json", inventory)

    # ---- 构建 state ----
    out_dir = str(settings.RUNS_DIR / run_id)
    state = ViralEngineState(
        # 用户输入
        sample_videos=[],
        user_materials=[],
        target_topic=target_topic,
        target_info={"description": f"基于{len(items)}张旅行照片生成的Vlog，素材涵盖：{tag_summary}，整体情绪：{emotion_summary}"},
        user_preferences={"style": "vlog", "narrative_type": "travel"},
        # Vlog 配置
        domain="vlog",
        vlog_style_preference="travel",
        narrative_type_hint="travel_vlog",
        persona_config={},
        # 共享工作区 — 预填 inventory
        source_structures=[],      # 空，无爆款分析
        material_inventory=inventory,
        scheme=None,
        knowledge_refs=[],
        gap_report={},
        generated_materials=[],
        rendered_video_path="",
        review_result={},
        output_dir=out_dir,
        run_id=run_id,
        # 通信
        current_task={},
        last_result={},
        # 流程控制 — 直接从 planning 阶段开始
        phase="planning",
        iteration=0,
        max_iterations=max_iterations,
        is_complete=False,
        errors=[],
        logs=[],
    )

    # ---- 按顺序执行节点 ----
    from graph.builder import planner_node, renderer_node, creative_node, assembler_node, reviewer_node

    nodes = [
        ("planner", planner_node),
        ("renderer", renderer_node),
        ("creative", creative_node),
        ("assembler", assembler_node),
        ("reviewer", reviewer_node),
    ]

    for name, node_func in nodes:
        logger.info(f"\n{'='*50}")
        logger.info(f"执行节点: {name}")
        logger.info(f"{'='*50}")
        try:
            updates = await node_func(state)
            state.update(updates)
            logger.info(f"[{name}] 完成")
        except Exception as e:
            logger.exception(f"[{name}] 异常: {e}")
            state.setdefault("errors", []).append(str(e))
            # 如果渲染失败，继续往下走
            if name == "assembler":
                logger.warning("渲染失败，继续执行 reviewer")
                continue
            if name in ("planner",):
                logger.error(f"{name} 失败，无法继续")
                break

    # ---- 结果汇总 ----
    result = {
        "status": "completed",
        "target_topic": target_topic,
        "phase": state.get("phase"),
        "iteration": state.get("iteration", 0),
        "is_complete": state.get("is_complete", False),
        "scheme_frames": len(getattr(state.get("scheme"), "storyboard", [])),
        "rendered_video_path": state.get("rendered_video_path", ""),
        "review_result": state.get("review_result", {}),
        "error_count": len(state.get("errors", [])),
        "errors": state.get("errors", []),
        "run_id": run_id,
        "output_dir": out_dir,
    }

    out.save_pipeline_summary(state)
    out.save_json("", "result.json", result)

    # 打印结果
    print("\n" + "=" * 60)
    print(f"主题: {result['target_topic']}")
    print(f"最终阶段: {result['phase']}")
    print(f"方案分镜数: {result['scheme_frames']}")
    print(f"完成: {result['is_complete']}")
    print(f"错误数: {result['error_count']}")

    scheme = state.get("scheme")
    if scheme:
        sb = getattr(scheme, "storyboard", [])
        print(f"\n方案预览:")
        for f in sb[:5]:
            st = getattr(f, "shot_type", "?")
            desc = (getattr(f, "visual_description", "") or getattr(f, "purpose", ""))[:60]
            mat = getattr(f, "material_id", "") or getattr(f, "source_material_id", "")
            print(f"  [{st}] {desc} (素材: {mat})")
        if len(sb) > 5:
            print(f"  ... 共 {len(sb)} 个分镜")

    review = result.get("review_result", {})
    if review:
        print(f"\n审核:")
        print(f"  总分: {review.get('total_score', 'N/A')}")
        print(f"  通过: {review.get('pass', 'N/A')}")

    if result.get("rendered_video_path"):
        print(f"\n视频: {result['rendered_video_path']}")

    if result.get("errors"):
        print(f"\n错误:")
        for e in result["errors"]:
            print(f"  - {e}")

    print(f"\n输出目录: {out_dir}")
    print("=" * 60)

    return result


def main():
    parser = argparse.ArgumentParser(
        description="测试：从已有 inventory 启动 pipeline，跳过视频分析阶段"
    )
    parser.add_argument("--topic", required=True, help="视频主题")
    parser.add_argument("--inventory", required=True, help="inventory JSON 文件路径")
    parser.add_argument("--max-iterations", type=int, default=3)

    args = parser.parse_args()
    result = asyncio.run(
        run_inventory_pipeline(
            inventory_path=args.inventory,
            target_topic=args.topic,
            max_iterations=args.max_iterations,
        )
    )
    return result


if __name__ == "__main__":
    main()
