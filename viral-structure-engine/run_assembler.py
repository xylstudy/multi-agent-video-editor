"""视频合成：按渲染决策，Ken Burns 运镜 + 拼接出片"""
import asyncio
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

from config.output_manager import OutputManager
from tools.video_tools import VideoTools


def build_material_map(inv_path: str) -> dict:
    inv = json.loads(Path(inv_path).read_text(encoding="utf-8"))
    items = inv.get("items", inv.get("materials", []))
    return {i["id"]: i["path"] for i in items if "id" in i and "path" in i}


def get_ken_burns_config(render_component: str, reasoning: str) -> tuple:
    motion_type = "zoom_in"
    speed = "slow"
    r = reasoning.lower()
    if "zoom_out" in r:
        motion_type = "zoom_out"
    elif "pan_right" in r:
        motion_type = "pan_right"
    elif "pan_left" in r:
        motion_type = "pan_left"
    elif "pan_up" in r:
        motion_type = "pan_up"
    elif "pan_down" in r:
        motion_type = "pan_down"
    return motion_type, speed


async def main():
    run_id = "assembler_output"
    out = OutputManager(run_id=run_id)
    video = VideoTools()
    logger.info(f"输出目录: {out.run_dir}")

    scheme = json.loads(
        Path("data/runs/scheme_generation_v3/planner/scheme.json").read_text(encoding="utf-8")
    )
    storyboard = scheme.get("storyboard", [])

    decisions = json.loads(
        Path("data/runs/render_decision/renderer/render_decisions.json").read_text(encoding="utf-8")
    )
    frame_decisions = {d["index"]: d for d in decisions.get("frame_decisions", [])}

    material_map = build_material_map("data/runs/material_analysis/material/inventory.json")
    logger.info(f"素材映射: {len(material_map)} 个")

    # 逐分镜生成视频片段
    logger.info("=" * 60)
    logger.info("逐分镜渲染...")

    clip_paths = []
    for frame in storyboard:
        idx = frame["index"]
        mid = frame.get("source_material_id", "") or frame.get("material_id", "")
        duration = frame.get("duration", 3.0)
        shot_type = frame.get("shot_type", "?")
        desc = frame.get("visual_description", "")[:30]

        dec = frame_decisions.get(idx, {})
        rc = dec.get("render_component", "auto")
        logger.info(f"  [{idx}] {shot_type:20s} | {duration:.1f}s | {desc}")

        img_path = material_map.get(mid)
        if img_path and Path(img_path).exists():
            motion_type, speed = get_ken_burns_config(rc, dec.get("reasoning", ""))
            try:
                clip = video.apply_ken_burns(img_path, motion_type, speed, duration=duration)
                clip_paths.append(clip)
                out.copy_to("assembler/clips", clip, f"shot_{idx:03d}.mp4")
                logger.info(f"         -> {motion_type}/{speed}")
            except Exception as e:
                logger.warning(f"         Ken Burns 失败: {e}")
                clip_paths.append(img_path)
        else:
            logger.warning(f"         素材不存在: {mid}")

    # 拼接
    logger.info("=" * 60)
    logger.info("拼接视频...")

    if not clip_paths:
        logger.error("没有可拼接的片段")
        return

    try:
        final_video = video.concat_clips(clip_paths, transition_duration=0.3)
        out.copy_to("assembler", final_video, "final_video.mp4")
        size_mb = Path(final_video).stat().st_size / 1024 / 1024
        logger.info(f"  [OK] 合成完成: {size_mb:.1f}MB")
        logger.info(f"  [OK] 路径: {out.run_dir / 'assembler' / 'final_video.mp4'}")
    except Exception as e:
        logger.error(f"拼接失败: {e}")
        return

    summary = {
        "shots": len(clip_paths),
        "clips": clip_paths,
        "output": str(out.run_dir / "assembler" / "final_video.mp4"),
    }
    out.save_json("assembler", "render_summary.json", summary)
    logger.info(f"\n完成! 共 {len(clip_paths)} 个镜头")


if __name__ == "__main__":
    asyncio.run(main())
