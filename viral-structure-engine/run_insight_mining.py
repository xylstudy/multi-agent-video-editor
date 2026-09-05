#!/usr/bin/env python3
"""InsightMiner CLI — 扫描分析报告，统计挖掘 + 生成自包含 HTML 洞察报告。

用法:
  python run_insight_mining.py                        # 默认扫描，输出到 data/output/
  python run_insight_mining.py --roots data/runs data/output --html my_report.html
"""
import argparse
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import settings
from knowledge.insight_miner import InsightMiner, discover_analyses
from insight_report import generate_report

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_ROOTS = [
    settings.RUNS_DIR,                 # data/runs/*/analyst/（旧格式）
    settings.OUTPUT_DIR,               # viral-structure-engine/data/output/
    Path(__file__).resolve().parent.parent / "data",  # 项目根 data/output/（CLI 默认输出）
    Path(__file__).resolve().parent.parent / "web" / "backend" / "storage",  # 基因报告
]


def parse_args():
    p = argparse.ArgumentParser(description="跨视频统计挖掘 + HTML 洞察报告")
    p.add_argument("--roots", nargs="+", type=str, default=None,
                   help="扫描根目录（默认: data/runs + data/output + web storage）")
    p.add_argument("--html", type=str, default=None,
                   help="HTML 报告输出路径（默认: data/output/insight_report.html）")
    p.add_argument("--insights-json", type=str, default=None,
                   help="挖掘结果 JSON 输出路径（默认: 与 HTML 同目录 insights.json）")
    return p.parse_args()


def main():
    args = parse_args()
    roots = [Path(r) for r in args.roots] if args.roots else DEFAULT_ROOTS
    html_out = Path(args.html) if args.html else settings.OUTPUT_DIR / "insight_report.html"
    json_out = Path(args.insights_json) if args.insights_json else html_out.parent / "insights.json"

    videos = discover_analyses(roots)
    if not videos:
        logger.warning("未发现任何分析报告，请先用 analyze_video.py 分析至少一个视频")
        sys.exit(1)

    miner = InsightMiner(videos)
    mined = miner.mine()

    json_out.parent.mkdir(parents=True, exist_ok=True)
    json_out.write_text(json.dumps(mined, ensure_ascii=False, indent=2), encoding="utf-8")
    report_path = generate_report(mined, videos, html_out)

    print("\n===== 洞察摘要 =====")
    for i in mined["insights"]:
        print(f"[{i['dimension']:12s}] ({i['confidence']}, n={i['sample_size']}) {i['finding']}")
    print(f"\n[OK] 洞察 JSON: {json_out.resolve()}")
    print(f"[OK] HTML 报告: {report_path.resolve()}")


if __name__ == "__main__":
    main()
