"""用 Remotion 合成最终视频（支持视频素材 + 图片 Ken Burns + 字幕 + 转场）"""
import argparse
import json
import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

from config.output_manager import OutputManager

PROJECT_ROOT = Path(__file__).resolve().parent


def parse_args():
    parser = argparse.ArgumentParser(description="用 Remotion 合成最终视频")
    parser.add_argument(
        "--scheme",
        type=str,
        default=str(PROJECT_ROOT / "data" / "runs" / "scheme_generation_v3" / "planner" / "scheme.json"),
        help="视频方案 JSON 路径（默认: data/runs/scheme_generation_v3/planner/scheme.json）",
    )
    parser.add_argument(
        "--run-id",
        type=str,
        default="assembler_output",
        help="本次运行 ID（默认: assembler_output）",
    )
    return parser.parse_args()


def build_material_map() -> dict:
    """合并照片素材和爆款视频片段，值保持本地路径"""
    material_map = {}

    photo_inv_path = PROJECT_ROOT / "data" / "runs" / "material_analysis" / "material" / "inventory.json"
    if photo_inv_path.exists():
        photo_inv = json.loads(photo_inv_path.read_text(encoding="utf-8"))
        for item in photo_inv.get("items", photo_inv.get("materials", [])):
            mid = item.get("id", "")
            mpath = item.get("path", "")
            if mid and mpath and Path(mpath).exists():
                material_map[mid] = str(Path(mpath).resolve())

    viral_inv_path = PROJECT_ROOT / "data" / "runs" / "viral_clips" / "viral" / "inventory.json"
    if viral_inv_path.exists():
        viral_inv = json.loads(viral_inv_path.read_text(encoding="utf-8"))
        for item in viral_inv.get("items", []):
            mid = item.get("id", "")
            mpath = item.get("path", "")
            if mid and mpath and Path(mpath).exists():
                material_map[mid] = str(Path(mpath).resolve())

    return material_map


def main():
    args = parse_args()

    run_id = args.run_id
    out = OutputManager(run_id=run_id)
    logger.info(f"输出目录: {out.run_dir}")

    # 1. 加载方案
    scheme_path = Path(args.scheme)
    scheme = json.loads(scheme_path.read_text(encoding="utf-8"))
    storyboard = scheme.get("storyboard", [])
    logger.info(f"方案: {scheme.get('title', '?')}, {len(storyboard)} 个分镜")

    # 2. 构建素材映射（本地路径）
    local_material_map = build_material_map()
    logger.info(f"素材映射: {len(local_material_map)} 个")

    # 检查分镜素材是否存在
    missing = []
    for f in storyboard:
        mid = f.get("material_id") or f.get("source_material_id", "")
        if mid and mid not in local_material_map:
            missing.append(mid)
    if missing:
        logger.warning(f"缺失素材: {missing}")
    else:
        logger.info("所有分镜素材已就绪")

    # 3. 调用统一 Remotion 渲染器
    from tools.remotion_renderer import render_with_remotion

    output = str((out.run_dir / "assembler" / "final_video.mp4").resolve())
    Path(output).parent.mkdir(parents=True, exist_ok=True)

    # 把本地路径映射转成对象列表，统一渲染器可直接消费
    material_items = [
        {"id": mid, "path": path}
        for mid, path in local_material_map.items()
    ]

    logger.info("Remotion 渲染中...")
    result_path = render_with_remotion(scheme, material_items, output, timeout=600)

    if not result_path:
        logger.error("Remotion 渲染失败")
        return

    size_mb = Path(result_path).stat().st_size / 1024 / 1024
    logger.info(f"[OK] 渲染完成: {result_path}")
    logger.info(f"[OK] 文件大小: {size_mb:.1f}MB")

    # 4. 保存渲染摘要
    summary = {
        "shots": len(storyboard),
        "title": scheme.get("title", ""),
        "output": result_path,
        "size_mb": round(size_mb, 1),
        "method": "remotion",
        "material_count": len(material_items),
    }
    out.save_json("assembler", "render_summary.json", summary)


if __name__ == "__main__":
    main()
