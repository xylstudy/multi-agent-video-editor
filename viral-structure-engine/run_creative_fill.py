"""创意补全：生成缺口素材（标题卡、转场、结尾卡）"""
import asyncio
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

from config import settings
from config.output_manager import OutputManager
from tools.video_tools import VideoTools


async def main():
    run_id = "creative_fill"
    out = OutputManager(run_id=run_id)
    video = VideoTools()
    logger.info(f"输出目录: {out.run_dir}")

    # 加载方案
    scheme = json.loads(
        Path("data/runs/scheme_generation_v2/planner/scheme.json").read_text(encoding="utf-8")
    )
    storyboard = scheme.get("storyboard", [])

    # ===== 分析缺口 =====
    logger.info("=" * 60)
    logger.info("缺口分析")
    fill_plan = []

    for frame in storyboard:
        mid = frame.get("source_material_id", "") or frame.get("material_id", "")
        shot_type = frame.get("shot_type", "?")
        logger.info(f"  [{frame['index']}] {shot_type:20s} | 素材: {mid or '无'}")

        # 检查每个分镜的素材缺口
        gaps = []
        if not mid:
            gaps.append("无素材")

        fill_plan.append({
            "index": frame["index"],
            "shot_type": shot_type,
            "material_id": mid,
            "gaps": gaps,
            "fill_strategy": "use_existing_material" if mid else "generate_image",
        })

    # ===== 生成开场标题卡 =====
    logger.info("=" * 60)
    logger.info("生成开场标题卡...")
    try:
        title_card = video.generate_text_card(
            text="北京旅行Vlog",
            bg_color="black",
            text_color="white",
            animation="fade_in",
            duration=2.0,
        )
        out.copy_to("creative", title_card, "title_card.mp4")
        fill_plan.insert(0, {
            "index": -1,
            "shot_type": "title_card",
            "material_id": "",
            "gaps": [],
            "fill_strategy": "generated_text_card",
            "generated_path": str(out.run_dir / "creative" / "title_card.mp4"),
        })
        logger.info(f"  [OK] 标题卡 -> title_card.mp4")
    except Exception as e:
        logger.warning(f"  标题卡生成失败: {e}")

    # ===== 生成结尾卡 =====
    logger.info("生成结尾卡...")
    try:
        end_card = video.generate_text_card(
            text="谢谢观看",
            bg_color="black",
            text_color="white",
            animation="fade_in",
            duration=2.0,
        )
        out.copy_to("creative", end_card, "end_card.mp4")
        fill_plan.append({
            "index": 99,
            "shot_type": "end_card",
            "material_id": "",
            "gaps": [],
            "fill_strategy": "generated_text_card",
            "generated_path": str(out.run_dir / "creative" / "end_card.mp4"),
        })
        logger.info(f"  [OK] 结尾卡 -> end_card.mp4")
    except Exception as e:
        logger.warning(f"  结尾卡生成失败: {e}")

    # ===== 补全策略 =====
    # 方案中的素材都是静态照片，渲染时需要转 Ken Burns 动画
    # 这不是 creative 的缺口，是 render 阶段的处理
    logger.info("=" * 60)
    logger.info("补全策略汇总")

    for plan in fill_plan:
        if plan["index"] < 0:
            logger.info(f"  [标题卡] {plan['fill_strategy']}")
        elif plan["index"] >= 99:
            logger.info(f"  [结尾卡] {plan['fill_strategy']}")
        else:
            logger.info(f"  [分镜{plan['index']}] {plan['shot_type']:20s} -> {plan['fill_strategy']}")

    # 保存补全计划
    out.save_json("creative", "fill_plan.json", fill_plan)

    # 也生成方案的分镜-素材对应清单，方便后续渲染使用
    material_map = {}
    for plan in fill_plan:
        if plan["material_id"]:
            material_map[plan["index"]] = plan["material_id"]
    out.save_json("creative", "material_mapping.json", {
        str(k): v for k, v in material_map.items()
    })

    logger.info(f"\n补全计划已保存至: {out.run_dir / 'creative'}")
    logger.info(f"下一步: 渲染决策 + 视频合成")


if __name__ == "__main__":
    asyncio.run(main())
