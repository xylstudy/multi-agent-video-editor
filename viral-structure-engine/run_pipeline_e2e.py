"""快速端到端流程：利用现有分析 + 新素材 + 剪辑手法学识 → 生成方案 → Remotion 渲染"""
import argparse
import asyncio
import json
import logging
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

from config.llm_client import LLMTools
from config import settings
from config.output_manager import OutputManager
from agents.planner import PlannerAgent
from knowledge.techniques_loader import get_summary

PROJECT_ROOT = Path(__file__).resolve().parent


def parse_args():
    parser = argparse.ArgumentParser(description="快速端到端结构迁移 Pipeline")
    parser.add_argument(
        "--struct",
        type=str,
        required=True,
        help="视频结构分析结果路径",
    )
    parser.add_argument(
        "--struct-analysis",
        type=str,
        required=True,
        help="结构分析详细结果路径",
    )
    parser.add_argument(
        "--photo-dir",
        type=str,
        default="",
        help="用户照片素材目录；未传 --inventory 时使用",
    )
    parser.add_argument(
        "--inventory",
        type=str,
        default="",
        help="已分析的素材库存 JSON",
    )
    parser.add_argument(
        "--topic",
        type=str,
        default="我的短视频",
        help="目标视频主题",
    )
    parser.add_argument(
        "--run-id",
        type=str,
        default="pipeline_e2e_techniques",
        help="本次运行 ID（默认: pipeline_e2e_techniques）",
    )
    parser.add_argument(
        "--knowledge-context",
        type=str,
        default="",
        help="当前用户个人知识 JSON；由 Web 后端按用户过滤后传入",
    )
    parser.add_argument("--output", type=str, default="", help="最终视频精确输出路径")
    parser.add_argument("--scheme-output", type=str, default="", help="最终方案 JSON 输出路径")
    parser.add_argument("--prepare-only", action="store_true", help="只生成分镜草案，不渲染")
    return parser.parse_args()


def infer_target_duration(topic: str, reference_duration: float = 0) -> float:
    """Prefer an explicit duration in the topic, then the reference duration."""
    match = re.search(r"(\d+(?:\.\d+)?)\s*(?:秒|s(?:ec(?:ond)?s?)?\b)", topic, re.IGNORECASE)
    if match:
        return max(1.0, min(600.0, float(match.group(1))))
    if reference_duration > 0:
        return max(1.0, min(600.0, float(reference_duration)))
    return 45.0


def normalize_storyboard_duration(scheme_data: dict, target_duration: float) -> dict:
    """Scale model-proposed shot durations to an exact, deterministic total."""
    frames = scheme_data.get("storyboard", [])
    if not frames or target_duration <= 0:
        return scheme_data

    durations = [max(0.2, float(frame.get("duration", 3.0))) for frame in frames]
    total = sum(durations)
    if total <= 0:
        return scheme_data

    scaled = [max(0.2, round(value * target_duration / total, 3)) for value in durations]
    scaled[-1] = round(scaled[-1] + target_duration - sum(scaled), 3)
    if scaled[-1] < 0.2:
        deficit = round(0.2 - scaled[-1], 3)
        scaled[-1] = 0.2
        for index in range(len(scaled) - 2, -1, -1):
            available = max(0.0, scaled[index] - 0.2)
            taken = min(available, deficit)
            scaled[index] = round(scaled[index] - taken, 3)
            deficit = round(deficit - taken, 3)
            if deficit <= 0:
                break

    for frame, duration in zip(frames, scaled):
        frame["duration"] = duration
    scheme_data["target_duration"] = round(sum(scaled), 3)
    return scheme_data


def build_preferences(topic: str, target_duration: float = 45.0) -> dict:
    subject = topic.strip() or "短视频"
    shot_count = "6-10个分镜" if target_duration <= 20 else "12-16个分镜"
    return {
        "style": f"贴合“{subject}”的创意短视频风格",
        "shot_count_target": shot_count,
        "total_duration_guide": f"严格控制为 {target_duration:g} 秒",
        "material_usage": "优先使用内容匹配且质量较高的不同素材，避免无意义重复",
        "note": "根据参考视频的结构、节奏与情绪曲线安排运镜和转场。",
    }


async def main():
    args = parse_args()

    run_id = args.run_id
    out = OutputManager(run_id=run_id)
    logger.info(f"输出目录: {out.run_dir}")

    # ===== 1. 加载现有视频结构分析 =====
    logger.info("=" * 60)
    logger.info("1. 加载视频结构分析")
    struct_path = Path(args.struct)
    struct = json.loads(struct_path.read_text(encoding="utf-8"))
    target_duration = infer_target_duration(args.topic, float(struct.get("duration", 0) or 0))
    logger.info(f"   视频: {struct.get('source_video', '?')}")
    logger.info(f"   时长: {struct.get('duration', 0):.1f}s, 镜头: {len(struct.get('shots', []))}")

    struct_analysis_path = Path(args.struct_analysis)
    struct_analysis = json.loads(struct_analysis_path.read_text(encoding="utf-8")) if struct_analysis_path.exists() else {}

    # ===== 2. 加载素材 =====
    logger.info("=" * 60)
    logger.info("2. 加载用户素材")
    if args.inventory:
        inventory = json.loads(Path(args.inventory).read_text(encoding="utf-8"))
        inventory.setdefault("items", inventory.get("materials", []))
    elif args.photo_dir:
        photo_dir = Path(args.photo_dir)
        photo_paths = sorted([
            p for p in photo_dir.glob("*") if p.suffix.lower() in (".jpg", ".jpeg", ".png")
        ])
        inventory = {
            "items": [
                {"id": f"mat_{i:03d}", "path": str(p.resolve()), "type": "image", "description": p.stem[:40]}
                for i, p in enumerate(photo_paths)
            ]
        }
    else:
        raise ValueError("必须传入 --inventory 或 --photo-dir")
    inventory["materials"] = inventory["items"]
    logger.info(f"   共 {len(inventory['items'])} 张照片")

    # ===== 3. 注入剪辑手法学识，生成方案 =====
    logger.info("=" * 60)
    logger.info("3. 编导生成方案 (DeepSeek + 剪辑手法学识)")

    techniques = get_summary()
    logger.info(f"   注入 {len(techniques)} 行学识")
    # 打印部分学识预览
    for line in techniques.split("\n")[:6]:
        logger.info(f"   {line}")

    llm = LLMTools(
        api_key=settings.TEXT_API_KEY,
        base_url=settings.TEXT_BASE_URL,
        model=settings.TEXT_MODEL_ID,
    )
    planner = PlannerAgent(llm)

    structure_summary = json.dumps(struct, ensure_ascii=False)
    structure_analysis_json = json.dumps(struct_analysis, ensure_ascii=False)

    skeleton = await planner._extract_skeleton(structure_summary, args.topic, "", structure_analysis=structure_analysis_json)
    out.save_json("planner", "skeleton.json", skeleton)
    logger.info(f"   骨架: {skeleton.get('structure_type', '?')}")

    inv_json = json.dumps(inventory, ensure_ascii=False)
    preferences_data = build_preferences(args.topic, target_duration)
    if args.knowledge_context:
        context_path = Path(args.knowledge_context)
        if context_path.exists():
            try:
                personal_entries = json.loads(context_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                logger.warning("个人知识上下文读取失败: %s", exc)
                personal_entries = []
            if personal_entries:
                # 控制 prompt 体积；优先采用最近写入文件尾部的个人知识。
                preferences_data["personal_knowledge"] = [
                    {
                        "id": entry.get("id", ""),
                        "type": entry.get("type", ""),
                        "title": entry.get("title", ""),
                        "content": entry.get("content", ""),
                        "tags": entry.get("tags", []),
                        "best_when": entry.get("best_when", ""),
                    }
                    for entry in personal_entries[-20:]
                ]
                logger.info("   注入当前用户个人知识 %d 条", len(preferences_data["personal_knowledge"]))
    preferences = json.dumps(preferences_data, ensure_ascii=False)

    # manually inject techniques into the generate call
    scheme_data = await planner._generate_scheme(
        json.dumps(skeleton, ensure_ascii=False), inv_json,
        args.topic, "", preferences,
        material_type_hint="全部为静态照片素材，需要做 Ken Burns 运镜。建议每镜用不同照片。",
    )
    normalize_storyboard_duration(scheme_data, target_duration)
    out.save_json("planner", "scheme_raw.json", scheme_data)

    scheme = planner.build_scheme(scheme_data, args.topic, iteration=0)
    out.save_json("planner", "scheme.json", scheme)
    logger.info(f"   方案: {scheme.title}, {len(scheme.storyboard)} 个分镜, {scheme.target_duration}s")

    for f in scheme.storyboard:
        logger.info(f"   [{f.index}] {f.shot_type.value:20s} | {f.duration:.1f}s | {f.visual_content[:50] if f.visual_content else ''}")

    # ===== 4. 渲染决策 =====
    logger.info("=" * 60)
    logger.info("4. 渲染决策")

    from agents.renderer import RendererAgent
    renderer = RendererAgent(llm)

    scheme_json = json.dumps(scheme.to_dict() if hasattr(scheme, "to_dict") else scheme_data, ensure_ascii=False)
    decisions = await renderer._analyze_scheme(scheme_json, f"{len(inventory['items'])} 个素材")
    out.save_json("renderer", "render_decisions.json", decisions)

    frame_decisions = decisions.get("frame_decisions", [])
    for d in frame_decisions:
        logger.info(f"   [{d.get('index', '?')}] render: {d.get('render_component', 'auto')[:20]} | {d.get('reasoning', '')[:60]}")

    # ===== 5. Remotion 渲染 =====
    logger.info("=" * 60)
    logger.info("5. Remotion 渲染最终视频")

    scheme_dict = scheme.to_dict() if hasattr(scheme, "to_dict") else scheme_data
    # 将决策写回 scheme
    decisions_map = {d["index"]: d for d in frame_decisions}
    for frame in scheme_dict.get("storyboard", []):
        d = decisions_map.get(frame.get("index", -1), {})
        frame["render_component"] = d.get("render_component", "auto")

    if args.scheme_output:
        scheme_output = Path(args.scheme_output).resolve()
        scheme_output.parent.mkdir(parents=True, exist_ok=True)
        scheme_output.write_text(
            json.dumps(scheme_dict, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    if args.prepare_only:
        logger.info("分镜草案已生成，等待用户确认")
        return

    from tools.remotion_renderer import render_with_remotion

    output_path = Path(args.output).resolve() if args.output else (out.run_dir / "final_video.mp4").resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output = str(output_path)
    result_path = render_with_remotion(scheme_dict, inventory["items"], output, timeout=600)

    if result_path:
        size_mb = Path(result_path).stat().st_size / 1024 / 1024
        logger.info(f"   [OK] 渲染完成: {result_path}")
        logger.info(f"   [OK] 大小: {size_mb:.1f}MB")
    else:
        logger.error("   Remotion 渲染失败")

    logger.info("=" * 60)
    logger.info("端到端流程完成")


if __name__ == "__main__":
    asyncio.run(main())
