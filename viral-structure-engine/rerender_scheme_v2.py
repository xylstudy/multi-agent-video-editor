#!/usr/bin/env python3
"""目标重渲染：加载 scheme_v2 和 inventory 用 FFmpeg 渲染最终视频。"""
import argparse
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tools.ffmpeg_renderer import FFMpegRenderer
from tools.video_tools import VideoTools
from models.material import MaterialInventory

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_RUN_DIR = PROJECT_ROOT / "data" / "runs" / "20260607_162312_北京旅行Vlog"
DEFAULT_REFERENCE_VIDEO = PROJECT_ROOT / "data" / "samples" / "viral.mp4"


def parse_args():
    parser = argparse.ArgumentParser(description="加载 scheme_v2 和 inventory 用 FFmpeg 重渲染")
    parser.add_argument(
        "--run-dir",
        type=str,
        default=str(DEFAULT_RUN_DIR),
        help="包含 planner/scheme_v2.json 和 material/inventory.json 的运行目录",
    )
    parser.add_argument(
        "--reference-video",
        type=str,
        default=str(DEFAULT_REFERENCE_VIDEO),
        help="参考视频路径，用于提取 BGM（默认: data/samples/viral.mp4）",
    )
    return parser.parse_args()

def load_scheme_v2(run_dir: Path):
    path = run_dir / "planner" / "scheme_v2.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    from models.scheme import VideoScheme, StoryboardFrame
    from models.video_structure import ShotType, TransitionType

    shot_map = {
        "hook": ShotType.HOOK, "transition": ShotType.TRANSITION,
        "scene_establish": ShotType.SCENE_ESTABLISH, "daily_moment": ShotType.DAILY_MOMENT,
        "emotion_peak": ShotType.EMOTION_PEAK, "persona": ShotType.PERSONA_EXPRESSION,
        "info_card": ShotType.INFO_CARD, "closing": ShotType.CLOSING_MOMENT,
    }
    trans_map = {
        "cut": TransitionType.CUT, "fade": TransitionType.FADE, "dissolve": TransitionType.DISSOLVE,
        "zoom_in": TransitionType.ZOOM_IN, "zoom_out": TransitionType.ZOOM_OUT,
        "flash_white": TransitionType.FLASH_WHITE, "slide": TransitionType.SLIDE,
        "whip": TransitionType.WHIP,
    }

    frames = []
    for fd in data.get("storyboard", []):
        frames.append(StoryboardFrame(
            index=fd["index"], start_time=0, end_time=0,
            duration=fd.get("duration", 3),
            purpose=fd.get("visual_description", ""),
            shot_type=shot_map.get(fd.get("shot_type", ""), ShotType.DAILY_MOMENT),
            visual_content=fd.get("visual_description", ""),
            material_id=fd.get("source_material_id", ""),
            subtitle_text=fd.get("subtitle_text", ""),
            voiceover_text=fd.get("voiceover_text", ""),
            transition=trans_map.get(fd.get("transition_in", "cut"), TransitionType.CUT),
            emotion=fd.get("emotion", ""),
            has_face=fd.get("has_face", False),
            fg_source_id=fd.get("fg_source_id", ""),
            bg_source_id=fd.get("bg_source_id", ""),
            composite_mode=fd.get("composite_mode", "none"),
            subtitle_config=fd.get("subtitle_config", {}),
            render_component=fd.get("render_component", "auto"),
            custom_render_config=fd.get("custom_render_config", {}),
            layers=fd.get("layers", []),
            canvas_width=fd.get("canvas_width", 1080),
            canvas_height=fd.get("canvas_height", 1920),
            ffmpeg_segment=fd.get("ffmpeg_segment", {}),
        ))

    return VideoScheme(
        id="scheme_v2_rerender",
        title=data.get("title", "北京旅行Vlog"),
        target_topic="北京旅行Vlog",
        target_duration=data.get("target_duration", 45),
        structure_type=data.get("structure_type", ""),
        storyboard=frames,
        version=3,
        status="final",
        canvas_width=1080, canvas_height=1920,
        render_hints=data.get("render_hints", {}),
        audio_source_id=data.get("audio_source_id", ""),
        audio_config=data.get("audio_config", {}),
    )

def load_inventory(run_dir: Path):
    path = run_dir / "material" / "inventory.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    from models.material import MaterialItem, MaterialType, MaterialQuality
    items = []
    for d in data.get("items", []):
        items.append(MaterialItem(
            id=d.get("id", ""),
            type=MaterialType(d.get("type", "image")),
            path=d.get("path", ""),
            description=d.get("description", ""),
            main_subject=d.get("main_subject", ""),
            tags=d.get("tags", []),
            quality=MaterialQuality(d.get("quality", "medium")),
            emotion_label=d.get("emotion_label", ""),
            has_face=d.get("has_face", False),
            face_count=d.get("face_count", 0),
            resolution=d.get("resolution", "medium"),
            composition=d.get("composition", "okay"),
            light=d.get("light", "sufficient"),
            duration=d.get("duration", 0.0),
            width=d.get("width", 0),
            height=d.get("height", 0),
        ))
    return MaterialInventory(items=items)

def extract_audio(reference_video: str):
    vt = VideoTools()
    audio_path = vt.extract_audio(reference_video)
    if audio_path and Path(audio_path).exists():
        logger.info(f"音频已提取: {Path(audio_path).name}")
        return audio_path
    logger.warning("音频提取失败")
    return None

def main():
    args = parse_args()
    run_dir = Path(args.run_dir)

    scheme = load_scheme_v2(run_dir)
    inventory = load_inventory(run_dir)
    logger.info(f"Loaded scheme: {scheme.title} ({len(scheme.storyboard)} frames)")
    logger.info(f"Loaded inventory: {len(inventory.items)} items")

    # 核对素材 ID 是否存在
    existing_ids = {m.id for m in inventory.items}
    for frame in scheme.storyboard:
        bg_id = frame.bg_source_id or frame.source_material_id or frame.material_id
        if bg_id and bg_id not in existing_ids:
            logger.warning(f"  Frame {frame.index}: material {bg_id} not in inventory!")

    audio_path = extract_audio(args.reference_video)

    renderer = FFMpegRenderer()
    output = renderer.render(scheme, inventory, audio_path)

    if output:
        logger.info(f"\n{'='*60}")
        logger.info(f"渲染成功: {output}")
        logger.info(f"{'='*60}")
    else:
        logger.error("渲染失败")

if __name__ == "__main__":
    main()
