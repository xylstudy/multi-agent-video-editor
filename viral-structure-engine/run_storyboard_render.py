"""Render a confirmed storyboard without invoking any LLM."""
import argparse
import json
import logging
import subprocess
from pathlib import Path

from tools.remotion_renderer import render_with_remotion
from tools.video_tools import _find_ffmpeg

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="渲染已确认的分镜方案")
    parser.add_argument("--scheme", required=True, help="分镜方案 JSON")
    parser.add_argument("--materials", required=True, help="素材库存 JSON")
    parser.add_argument("--output", required=True, help="最终视频输出路径")
    parser.add_argument("--reference-video", default="", help="用于提取原视频音频的参考视频")
    return parser.parse_args()


def load_inventory(path: str) -> list[dict]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    return data.get("items", data.get("materials", []))


def extract_reference_audio(reference_video: str, output_dir: Path) -> str:
    audio_path = output_dir / "reference_audio.aac"
    subprocess.run(
        [
            _find_ffmpeg(),
            "-y",
            "-i",
            reference_video,
            "-vn",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(audio_path),
        ],
        capture_output=True,
        check=True,
    )
    return str(audio_path)


def main():
    args = parse_args()
    scheme_path = Path(args.scheme).resolve()
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    scheme = json.loads(scheme_path.read_text(encoding="utf-8"))
    materials = load_inventory(args.materials)
    if not materials:
        raise RuntimeError("素材库存为空，无法渲染")

    bgm = scheme.get("bgm", {})
    if bgm.get("audio_path") == "_viral_audio":
        if not args.reference_video or not Path(args.reference_video).is_file():
            raise RuntimeError("该分镜需要参考视频音频，但参考视频不存在")
        audio_path = extract_reference_audio(args.reference_video, output_path.parent)
        materials.append({"id": "_viral_audio", "path": audio_path})

    logger.info("开始渲染已确认分镜: %s 个镜头", len(scheme.get("storyboard", [])))
    result = render_with_remotion(scheme, materials, str(output_path), timeout=600)
    if not result:
        raise RuntimeError("Remotion 渲染失败")
    logger.info("渲染完成: %s", result)


if __name__ == "__main__":
    main()
