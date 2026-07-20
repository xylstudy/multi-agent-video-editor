import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tools.video_tools import VideoTools
from tools.face_tools import FaceTools
from agents.analyst import AnalystAgent

PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_VIDEO_PATH = PROJECT_ROOT / "data" / "samples" / "viral.mp4"
DEFAULT_SHOT_ANALYSES = PROJECT_ROOT / "data" / "output" / "claude_shot_analyses.json"
DEFAULT_STRUCTURE_ANALYSIS = PROJECT_ROOT / "data" / "output" / "claude_structure_analysis.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "output" / "analysis_result_claude.json"


def parse_args():
    parser = argparse.ArgumentParser(description="使用 Claude 预分析结果组装 VideoStructure")
    parser.add_argument(
        "--video",
        type=str,
        default=str(DEFAULT_VIDEO_PATH),
        help="原始视频路径（默认: data/samples/viral.mp4）",
    )
    parser.add_argument(
        "--shot-analyses",
        type=str,
        default=str(DEFAULT_SHOT_ANALYSES),
        help="Claude 镜头分析结果路径（默认: data/output/claude_shot_analyses.json）",
    )
    parser.add_argument(
        "--structure-analysis",
        type=str,
        default=str(DEFAULT_STRUCTURE_ANALYSIS),
        help="Claude 结构分析结果路径（默认: data/output/claude_structure_analysis.json）",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(DEFAULT_OUTPUT),
        help="输出路径（默认: data/output/analysis_result_claude.json）",
    )
    return parser.parse_args()


def run_analysis():
    args = parse_args()

    video_path = args.video
    video = VideoTools()
    face = FaceTools()
    analyst = AnalystAgent(None, video, face)

    info = video.get_video_info(video_path)
    scenes = video.detect_scene_changes(video_path, threshold=0.3)

    # 读取我（Claude）生成的分析结果
    with open(args.shot_analyses, "r", encoding="utf-8") as f:
        shot_analyses = json.load(f)
    with open(args.structure_analysis, "r", encoding="utf-8") as f:
        structure_analysis = json.load(f)

    # 对齐时间
    for i, scene in enumerate(scenes):
        if i < len(shot_analyses):
            shot_analyses[i]["start_time"] = scene["start"]
            shot_analyses[i]["end_time"] = scene["end"]

    # 组装 VideoStructure
    video_structure = analyst.build_video_structure(
        video_path, info["duration"], info["width"], info["height"],
        shot_analyses, structure_analysis, "",
    )

    # 打印摘要
    print("=" * 70)
    print("爆款结构迁移引擎 — Analyst Agent 单视频分析 (Claude 替代 LLM)")
    print("=" * 70)
    print(f"视频路径: {video_path}")
    print(f"\n[视频基本信息]:")
    print(f"   分辨率: {info['width']}x{info['height']}")
    print(f"   帧率: {info['fps']:.2f} fps")
    print(f"   时长: {info['duration']:.2f} 秒")
    print(f"   总帧数: {info['total_frames']}")
    print(f"\n[镜头切分结果]:")
    print(f"   检测到 {len(scenes)} 个镜头")

    print(f"\n" + "=" * 70)
    print("分析结果摘要")
    print("=" * 70)

    print(f"\n【视频元信息】")
    print(f"  时长: {video_structure.duration:.1f}s")
    print(f"  分辨率: {video_structure.resolution}")
    print(f"  镜头数: {len(video_structure.shots)}")

    print(f"\n【结构摘要】")
    print(f"  {video_structure.structure_summary or '（无）'}")

    print(f"\n【Hook 策略】")
    print(f"  方法: {video_structure.vlog_meta.hook_method or '（无）'}")
    print(f"  详情: {video_structure.hook_summary or '（无）'}")

    print(f"\n【Vlog 元信息】")
    print(f"  叙事类型: {video_structure.vlog_meta.narrative_type or '（无）'}")
    print(f"  结构类型: {video_structure.vlog_meta.structure_type or '（无）'}")
    print(f"  整体情绪: {video_structure.vlog_meta.overall_emotion or '（无）'}")

    print(f"\n【关键技法】")
    for t in video_structure.key_techniques:
        print(f"  - {t}")

    print(f"\n【镜头列表 ({len(video_structure.shots)} 个)】")
    for s in video_structure.shots:
        print(f"  镜头 {s.index+1}: {s.shot_type.value} | {s.visual_description[:30] if s.visual_description else '（无描述）'} | 情绪: {s.emotion or '?'} | 人脸: {'有' if s.has_face else '无'}")

    result = {
        "source_path": video_structure.source_path,
        "duration": video_structure.duration,
        "resolution": list(video_structure.resolution),
        "shot_count": len(video_structure.shots),
        "structure_summary": video_structure.structure_summary,
        "hook_summary": video_structure.hook_summary,
        "key_techniques": video_structure.key_techniques,
        "vlog_meta": video_structure.vlog_meta.to_dict() if hasattr(video_structure.vlog_meta, "to_dict") else {},
        "shots": [s.to_dict() if hasattr(s, "to_dict") else {} for s in video_structure.shots],
        "raw_structure_analysis": structure_analysis,
        "raw_shot_analyses": shot_analyses,
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"\n完整分析结果已保存至: {output_path.resolve()}")

    return result


if __name__ == "__main__":
    run_analysis()
