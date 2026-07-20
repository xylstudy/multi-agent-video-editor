"""
爆款结构迁移 — 北京照片 Pipeline
加载 Kimi 的分析结果 + 北京照片，运行 material_manager → planner → creative → reviewer
"""
import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import settings
from config.llm_client import LLMTools
from tools.video_tools import VideoTools
from tools.face_tools import FaceTools
from agents.material_manager import MaterialManagerAgent
from prompts.material_prompts import build_image_analysis_prompt
from agents.planner import PlannerAgent
from agents.reviewer import ReviewerAgent
from agents.assembler import AssemblerAgent
from models.material import MaterialItem, MaterialInventory, MaterialType, MaterialQuality
from models.scheme import VideoScheme
from models.video_structure import VideoStructure

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("pipeline")

PROJECT_ROOT = Path(__file__).resolve().parent


def parse_args():
    parser = argparse.ArgumentParser(description="北京照片爆款结构迁移 Pipeline")
    parser.add_argument(
        "--analysis",
        type=str,
        default=str(PROJECT_ROOT / "data" / "output" / "analysis_result_claude.json"),
        help="Kimi/Claude 结构分析结果路径（默认: data/output/analysis_result_claude.json）",
    )
    parser.add_argument(
        "--photo-dir",
        type=str,
        default=str(PROJECT_ROOT / "data" / "北京"),
        help="北京照片目录（默认: data/北京）",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(PROJECT_ROOT / "data" / "output"),
        help="中间产物与最终视频输出目录（默认: data/output）",
    )
    parser.add_argument(
        "--topic",
        type=str,
        default="北京旅行Vlog",
        help="目标视频主题（默认: 北京旅行Vlog）",
    )
    return parser.parse_args()


# ===== 配置（由命令行参数覆盖）=====
args = parse_args()
KIMI_ANALYSIS_PATH = Path(args.analysis)
BEIJING_PHOTO_DIR = Path(args.photo_dir)
TARGET_TOPIC = args.topic
OUTPUT_DIR = Path(args.output_dir)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ===== Prompt / 模型配置 =====
SYSTEM_PROMPT = """你是一位Vlog创作团队的资深成员。你的回答应该简洁、专业、用中文。
专注于结构迁移任务——把一个爆款Vlog的结构方法论迁移到新内容上。"""


class DictWrapper:
    """包装字典使其拥有 to_dict() 方法，兼容 pipeline 中的 hasattr 检查"""
    def __init__(self, data: dict):
        self.data = data
        self.structure_summary = data.get("structure_summary", "")
        self.duration = data.get("duration", 0)

    def to_dict(self):
        return self.data


def create_llm():
    """使用 DeepSeek（Moonshot key 仅支持 kimi-for-coding 专用模型，无法用于 API）"""
    return LLMTools(
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
        model="deepseek-chat",
    )


def create_vision_llm():
    """使用 Zhipu GLM-4.6V 进行视觉理解"""
    return LLMTools(
        api_key=settings.ZHIPU_API_KEY,
        base_url=settings.ZHIPU_BASE_URL,
        model="glm-4.6v",
    )


async def step_material_manager(llm, vision_llm, photo_paths: list[str]) -> MaterialInventory:
    """Step 1: 使用视觉模型（Zhipu GLM-4.6V）分析所有北京照片素材"""
    logger.info("=" * 60)
    logger.info("Step 1: 素材分析 (MaterialManager + Zhipu GLM-4.6V 视觉理解)")
    logger.info(f"照片数量: {len(photo_paths)}")
    logger.info("=" * 60)

    # 创建 MaterialManagerAgent 实例，复用 build_material_item 方法
    mgr = MaterialManagerAgent(llm, VideoTools(), FaceTools())

    items = []
    for idx, img_path in enumerate(photo_paths):
        mat_id = f"beijing_{idx}"
        logger.info(f"  分析照片 [{idx+1}/{len(photo_paths)}]: {Path(img_path).name}")
        try:
            # 使用视觉模型进行图文理解
            prompt = build_image_analysis_prompt(mat_id, TARGET_TOPIC, "北京旅行照片，展现北京的城市风貌、标志性建筑和人文气息")
            response = await vision_llm.chat_with_images(prompt, [img_path], response_format="json")
            analysis = vision_llm.parse_json(response)

            # 人脸检测（已修复中文路径问题）
            try:
                analysis["has_face"] = mgr.face.has_face(img_path)
                if analysis["has_face"]:
                    analysis["main_face_region"] = mgr.face.get_main_face_region(img_path)
            except Exception as e:
                logger.warning(f"    人脸检测失败: {e}")
                analysis["has_face"] = False

            item = mgr.build_material_item(mat_id, MaterialType.IMAGE, img_path, analysis)
            items.append(item)
            logger.info(f"    → {item.description[:50]} | 质量: {item.quality.value} | 人脸: {item.has_face}")
        except Exception as e:
            logger.warning(f"    ✗ 分析失败: {e}")
            items.append(MaterialItem(id=mat_id, type=MaterialType.IMAGE, path=img_path,
                                       description=Path(img_path).stem))

    inventory = MaterialInventory(items=items)
    logger.info(f"\n素材入库完成: {len(items)} 个素材")
    logger.info(f"有面孔的素材: {len(inventory.get_face_items())} 个")

    # 保存中间结果
    with open(OUTPUT_DIR / "beijing_inventory.json", "w", encoding="utf-8") as f:
        json.dump(inventory.to_dict(), f, ensure_ascii=False, indent=2)
    logger.info(f"素材清单已保存至: {OUTPUT_DIR / 'beijing_inventory.json'}")

    return inventory


async def step_planner(llm, kimi_analysis: dict, inventory: MaterialInventory):
    """Step 2: 方案生成 (Planner) — 骨架提取 + 方案生成"""
    logger.info("=" * 60)
    logger.info("Step 2: 方案生成 (Planner)")
    logger.info("=" * 60)

    planner = PlannerAgent(llm)

    # 2a. 提取骨架
    structure_summary = json.dumps(kimi_analysis, ensure_ascii=False)
    logger.info("提取结构骨架...")
    skeleton = await planner._extract_skeleton(
        structure_summary,
        TARGET_TOPIC,
        json.dumps({"description": "用北京旅行照片制作一条结构迁移Vlog"}, ensure_ascii=False),
    )
    logger.info(f"骨架提取完成: {json.dumps(skeleton, ensure_ascii=False)[:200]}...")

    with open(OUTPUT_DIR / "beijing_skeleton.json", "w", encoding="utf-8") as f:
        json.dump(skeleton, f, ensure_ascii=False, indent=2)

    # 2b. 生成方案
    inv_json = json.dumps(inventory.to_dict(), ensure_ascii=False)
    logger.info("生成视频方案...")
    scheme_data = await planner._generate_scheme(
        json.dumps(skeleton, ensure_ascii=False),
        inv_json,
        TARGET_TOPIC,
        json.dumps({"description": "北京旅行Vlog，展现北京的城市风貌、标志性建筑和人文气息"}, ensure_ascii=False),
        json.dumps({"style": "travel_vlog", "narrative_type": "timeline"}, ensure_ascii=False),
    )

    scheme = planner.build_scheme(scheme_data, TARGET_TOPIC, 0)
    logger.info(f"方案生成完成: {len(scheme.storyboard)} 个分镜, 目标时长 {scheme.target_duration}s")

    with open(OUTPUT_DIR / "beijing_scheme.json", "w", encoding="utf-8") as f:
        json.dump(scheme.to_dict(), f, ensure_ascii=False, indent=2)
    logger.info(f"方案已保存至: {OUTPUT_DIR / 'beijing_scheme.json'}")

    return scheme, skeleton


async def step_reviewer(llm, scheme: VideoScheme, kimi_analysis: dict, inventory: MaterialInventory):
    """Step 3: 方案审核 (Reviewer)"""
    logger.info("=" * 60)
    logger.info("Step 3: 方案审核 (Reviewer)")
    logger.info("=" * 60)

    reviewer = ReviewerAgent(llm)

    structure_summaries = json.dumps(kimi_analysis, ensure_ascii=False)
    scheme_json = json.dumps(scheme.to_dict(), ensure_ascii=False)

    storyboard_count = len(getattr(scheme, "storyboard", []))
    items_count = len(getattr(inventory, "items", getattr(inventory, "materials", [])))
    coverage = f"分镜: {storyboard_count}\n素材: {items_count}"

    review = await reviewer._review_scheme(structure_summaries, scheme_json, coverage)
    passed = review.get("pass", False)
    total_score = review.get("total_score", 0)

    logger.info(f"审核结果: 总分={total_score}, 通过={passed}")

    with open(OUTPUT_DIR / "beijing_review.json", "w", encoding="utf-8") as f:
        json.dump(review, f, ensure_ascii=False, indent=2)
    logger.info(f"审核结果已保存至: {OUTPUT_DIR / 'beijing_review.json'}")

    return review


async def step_assembler(scheme: VideoScheme, inventory: MaterialInventory) -> str:
    """Step 4: 视频合成 — 照片→Ken Burns→拼接→字幕→输出"""
    logger.info("=" * 60)
    logger.info("Step 4: 视频合成 (Assembler)")
    logger.info(f"分镜数量: {len(scheme.storyboard)}, 目标时长: {scheme.target_duration}s")
    logger.info("=" * 60)

    mat_map = {item.id: item.path for item in inventory.items}
    video = VideoTools()
    clip_paths = []

    for frame in scheme.storyboard:
        mat_ids = [m.strip() for m in frame.material_id.split(",") if m.strip()]
        materials = [mat_map.get(mid, "") for mid in mat_ids if mat_map.get(mid)]

        if not materials:
            logger.warning(f"  [{frame.index}] 无素材 → 文字卡")
            clip = video.generate_text_card(text=frame.subtitle_text or "北京", duration=frame.duration)
            clip_paths.append(clip)
            continue

        per_dur = frame.duration / max(len(materials), 1)
        frame_clips = []

        for mat_path in materials:
            name = Path(mat_path).name
            logger.info(f"  [{frame.index}] {per_dur:.1f}s ← {name}")
            try:
                clip = video.apply_ken_burns(mat_path, "zoom_in", "slow", duration=per_dur)
            except Exception as e:
                logger.warning(f"    Ken Burns 失败: {e} → 文字卡")
                clip = video.generate_text_card(text=name, duration=per_dur)
            frame_clips.append(clip)

        # 字幕叠加
        if frame.subtitle_text and frame_clips:
            try:
                frame_clips[0] = video.overlay_subtitle(frame_clips[0], {"text": frame.subtitle_text})
            except Exception as e:
                logger.warning(f"    字幕叠加失败: {e}")

        clip_paths.extend(frame_clips)

    if not clip_paths:
        logger.error("没有生成任何视频片段")
        return ""

    logger.info(f"拼接 {len(clip_paths)} 个片段...")
    concat_path = video.concat_clips(clip_paths)

    output_path = str(OUTPUT_DIR / "beijing_vlog.mp4")
    import shutil
    shutil.copy2(concat_path, output_path)
    size_mb = Path(output_path).stat().st_size / 1024 / 1024
    logger.info(f"最终视频: {output_path} ({size_mb:.1f}MB)")

    return output_path


async def main():
    # 1. 加载 Kimi 分析结果
    logger.info("加载 Kimi 分析结果...")
    with open(KIMI_ANALYSIS_PATH, "r", encoding="utf-8") as f:
        kimi_analysis = json.load(f)

    # 2. 提取北京照片路径
    photo_extensions = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    photo_paths = sorted([
        str(p) for p in BEIJING_PHOTO_DIR.iterdir()
        if p.suffix.lower() in photo_extensions
    ])
    logger.info(f"找到 {len(photo_paths)} 张北京照片")

    # 3a. DeepSeek 用于文本推理
    llm = create_llm()
    # 3b. Zhipu GLM-4.6V 用于视觉理解
    vision_llm = create_vision_llm()

    # 4. 素材分析（如有缓存则跳过）
    inv_path = OUTPUT_DIR / "beijing_inventory.json"
    if inv_path.exists():
        logger.info(f"素材清单缓存已存在，跳过 Step 1")
        with open(inv_path, "r", encoding="utf-8") as f:
            inv_data = json.load(f)
        items = []
        for it in inv_data.get("items", []):
            items.append(MaterialItem(
                id=it["id"],
                type=MaterialType(it["type"]),
                path=it["path"],
                description=it.get("description", ""),
                main_subject=it.get("main_subject", ""),
                tags=it.get("tags", []),
                quality=MaterialQuality(it.get("quality", "medium")),
                has_face=it.get("has_face", False),
                face_count=it.get("face_count", 0),
                emotion_label=it.get("emotion_label", ""),
                scene_type=it.get("scene_type", ""),
                vlog_value=it.get("vlog_value", "medium"),
                vlog_applicability=it.get("vlog_applicability", []),
            ))
        inventory = MaterialInventory(items=items)
    else:
        inventory = await step_material_manager(llm, vision_llm, photo_paths)

    # 5. 方案生成（Zhipu GLM-4.6V 支持 response_format=json）
    scheme, skeleton = await step_planner(vision_llm, kimi_analysis, inventory)

    # 6. 方案审核（Zhipu GLM-4.6V 支持 response_format=json）
    review = await step_reviewer(vision_llm, scheme, kimi_analysis, inventory)

    # 7. 视频合成
    video_path = await step_assembler(scheme, inventory)

    # 8. 输出总结
    print("\n" + "=" * 60)
    print("Pipeline 完成！")
    print(f"主题: {TARGET_TOPIC}")
    print(f"素材: {len(inventory.items)} 个")
    print(f"方案分镜: {len(scheme.storyboard)} 个")
    print(f"目标时长: {scheme.target_duration}s")
    print(f"审核总分: {review.get('total_score', 'N/A')}")
    print(f"审核通过: {review.get('pass', False)}")
    print("=" * 60)
    print(f"\n结果文件:")
    print(f"  素材清单: {OUTPUT_DIR / 'beijing_inventory.json'}")
    print(f"  结构骨架: {OUTPUT_DIR / 'beijing_skeleton.json'}")
    print(f"  视频方案: {OUTPUT_DIR / 'beijing_scheme.json'}")
    print(f"  审核结果: {OUTPUT_DIR / 'beijing_review.json'}")
    if video_path:
        print(f"  [video] 最终视频: {video_path}")
    print()

    # 8. 打印方案概要
    print("\n" + "=" * 60)
    print("视频方案详览:")
    print("=" * 60)
    for i, frame in enumerate(scheme.storyboard):
        print(f"  [{i:02d}] {frame.shot_type.value:16s} | {frame.duration:.1f}s | {frame.visual_content[:40]}")
    print(f"\n结构类型: {scheme.structure_type}")
    if review.get("scores"):
        print("\n审核维度评分:")
        for dim, data in review["scores"].items():
            print(f"  {dim}: {data.get('score', 'N/A')}/10 - {data.get('comment', '')}")


if __name__ == "__main__":
    asyncio.run(main())
