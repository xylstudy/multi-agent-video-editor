#!/usr/bin/env python3
"""将 editing_techniques.json 的手法学识种子到项目 KnowledgeStore。

用法:
  python knowledge/seed_techniques.py                    # 种子到默认知识库
  python knowledge/seed_techniques.py --summary          # 只打印摘要
  python knowledge/seed_techniques.py --path /custom/path/knowledge.json  # 自定义路径
"""
import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from knowledge.store import KnowledgeStore
from knowledge.techniques_loader import seed_store, get_summary

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="学动手法到知识库")
    parser.add_argument("--summary", action="store_true", help="只打印注册表摘要")
    parser.add_argument("--path", type=str, default=None, help="知识库 JSON 路径")
    args = parser.parse_args()

    if args.summary:
        print(get_summary())
        return

    store = KnowledgeStore(
        db_path=Path(args.path) if args.path else None
    )
    count = seed_store(store)
    logger.info(f"[OK] 共种子 {count} 条手法学识到知识库 ({store.db_path})")
    print("\n" + get_summary())


if __name__ == "__main__":
    main()
