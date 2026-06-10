"""从爆款视频提取 5 段结构片段（按结构分析的 act 划分）"""
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

from config.output_manager import OutputManager
from models.material import MaterialItem, MaterialType, MaterialQuality
from tools.video_tools import VideoTools


def main():
    run_id = "viral_clips"
    out = OutputManager(run_id=run_id)
    video = VideoTools()
    logger.info(f"输出目录: {out.run_dir}")

    # 1. 加载爆款视频结构分析
    structure = json.loads(
        Path("data/runs/video_analysis_demo/analyst/structure_analysis.json").read_text(encoding="utf-8")
    )
    acts = structure.get("script_structure", [])

    # 2. 加载 scenes（每个 scene 1s，shot i → [i, i+1]s）
    scenes = json.loads(
        Path("data/runs/video_analysis_demo/analyst/scenes.json").read_text(encoding="utf-8")
    )
    logger.info(f"爆款视频分析: {len(acts)} 个结构段落, {len(scenes)} 个镜头")

    # 3. 从 video_structure 获取原视频路径
    vs = json.loads(
        Path("data/runs/video_analysis_demo/analyst/video_structure.json").read_text(encoding="utf-8")
    )
    source_path = vs.get("source_path", "")
    if not source_path or not Path(source_path).exists():
        logger.error(f"原视频不存在: {source_path}")
        return
    logger.info(f"原视频: {source_path}")

    # 4. 解析每段 act 的 shot_range → 时间范围
    clip_items = []
    for act in acts:
        shot_range_str = act.get("shot_range", "")
        # 格式如 "镜头0 - 镜头6" → index 0-6
        parts = shot_range_str.replace("镜头", "").split("-")
        if len(parts) != 2:
            logger.warning(f"无法解析 shot_range: {shot_range_str}")
            continue
        shot_start = int(parts[0].strip())
        shot_end = int(parts[1].strip())

        start_time = scenes[shot_start]["start"] if shot_start < len(scenes) else 0
        end_time = scenes[shot_end]["end"] if shot_end < len(scenes) else scenes[-1]["end"]
        duration = end_time - start_time
        if duration <= 0:
            logger.warning(f"段落 {act['index']} 时长为 0，跳过")
            continue

        emotion = act.get("emotion", "")
        purpose = act.get("purpose", "")
        content = act.get("content_summary", "")[:60]

        clip_id = f"viral_act_{act['index']}"
        clip_path = video.extract_highlight_clip(source_path, start_time, end_time)
        # 复制到输出目录
        # 用英文情绪标签避免 Windows HTTP server 中文路径 404
        emo_map = {"期待": "expect", "好奇": "curious", "活力": "energy", "平静": "calm", "震撼": "awe",
                    "温暖": "warm", "感动": "touched", "兴奋": "excited", "宁静": "peaceful", "满足": "content"}
        eng_emo = emo_map.get(emotion, f"emo{act['index']}")
        clip_name = f"act_{act['index']:02d}_{eng_emo}.mp4"
        out.copy_to("viral", clip_path, clip_name)
        final_path = str((out.run_dir / "viral" / clip_name).resolve())

        clip_items.append(MaterialItem(
            id=clip_id,
            type=MaterialType.VIDEO,
            path=final_path,
            description=f"[爆款片段] {purpose} — {content}",
            emotion_label=emotion,
            scene_type=purpose,
            duration=duration,
            tags=["viral_clip", purpose, emotion],
            quality=MaterialQuality.HIGH,
            has_usable_audio=False,
        ))

        logger.info(f"  [{clip_id}] {purpose:12s} | {duration:.1f}s | {emotion} | {shot_range_str}")

    # 5. 保存 inventory（纯 MaterialItem 列表）
    inventory_data = {
        "items": [item.to_dict() for item in clip_items],
        "source_video": source_path,
        "total_clips": len(clip_items),
    }
    out.save_json("viral", "inventory.json", inventory_data)
    logger.info(f"\n完成! 提取 {len(clip_items)} 个视频片段")


if __name__ == "__main__":
    main()
