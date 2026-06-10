"""渲染决策：DeepSeek 逐分镜分析渲染策略"""
import asyncio
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

from config.llm_client import LLMTools
from config import settings
from config.output_manager import OutputManager
from agents.renderer import RendererAgent


async def main():
    run_id = "render_decision"
    out = OutputManager(run_id=run_id)
    logger.info(f"输出目录: {out.run_dir}")

    llm = LLMTools(
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
        model="deepseek-chat",
    )
    renderer = RendererAgent(llm)

    # 加载方案
    scheme_path = Path("data/runs/scheme_generation_v3/planner/scheme.json")
    scheme = json.loads(scheme_path.read_text(encoding="utf-8"))
    storyboard = scheme.get("storyboard", [])

    # 加载素材
    inv = json.loads(
        Path("data/runs/material_analysis/material/inventory.json").read_text(encoding="utf-8")
    )
    items = inv.get("items", inv.get("materials", []))
    inv_summary = f"{len(items)} 个素材，全部为静态照片"

    logger.info(f"方案: {len(storyboard)} 个分镜, {scheme.get('target_duration', '?')}s")

    # ===== 渲染决策 =====
    logger.info("=" * 60)
    logger.info("逐分镜渲染策略分析 (DeepSeek)...")
    scheme_json = json.dumps(scheme, ensure_ascii=False)
    decisions = await renderer._analyze_scheme(scheme_json, inv_summary)
    out.save_json("renderer", "render_decisions.json", decisions)

    frame_decisions = decisions.get("frame_decisions", [])
    logger.info(f"决策完成: {len(frame_decisions)} 个分镜")

    # 打印渲染计划
    logger.info("=" * 60)
    logger.info("渲染计划:")
    for d in frame_decisions:
        rc = d.get("render_component", "auto")
        idx = d.get("index", "?")
        reasoning = d.get("reasoning", "")[:50]
        logger.info(f"   [{idx}] 组件: {rc:15s} | {reasoning}")

    logger.info(f"\n渲染决策已保存至: {out.run_dir / 'renderer'}")


if __name__ == "__main__":
    asyncio.run(main())
