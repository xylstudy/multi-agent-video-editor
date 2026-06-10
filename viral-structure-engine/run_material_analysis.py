"""素材入库分析：GLM-4.6V 逐张分析北京照片"""
import asyncio
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

from config.llm_client import LLMTools
from config import settings
from config.output_manager import OutputManager
from tools.face_tools import FaceTools
from agents.material_manager import MaterialManagerAgent
from models.material import MaterialType, MaterialInventory


async def main():
    target_topic = "北京旅行Vlog"
    materials_json = "./data/temp/beijing_materials.json"
    run_id = "material_analysis"

    out = OutputManager(run_id=run_id)
    logger.info(f"输出目录: {out.run_dir}")

    # GLM-4.6V：视觉理解
    vision_llm = LLMTools(
        api_key=settings.ZHIPU_API_KEY,
        base_url=settings.ZHIPU_BASE_URL,
        model="glm-4.6v",
    )

    face_tools = FaceTools()
    manager = MaterialManagerAgent(vision_llm, face=face_tools)

    # 加载素材列表
    with open(materials_json, "r", encoding="utf-8") as f:
        user_materials = json.load(f)
    logger.info(f"加载 {len(user_materials)} 个素材")

    items = []
    fail_count = 0
    total = len(user_materials)

    for idx, mat in enumerate(user_materials):
        mat_id = mat.get("id", "")
        mat_path = mat.get("path", "")
        mat_type_str = mat.get("type", "image")

        try:
            mtype = MaterialType(mat_type_str)
        except ValueError:
            mtype = MaterialType.IMAGE

        if not Path(mat_path).exists():
            logger.warning(f"   [{idx+1}/{total}] 素材不存在: {mat_path}")
            continue

        logger.info(f"   [{idx+1}/{total}] {Path(mat_path).name} ({mat_type_str})")

        try:
            if mtype == MaterialType.IMAGE:
                analysis = await manager._analyze_image(mat_id, mat_path, target_topic)
                item = manager.build_material_item(mat_id, mtype, mat_path, analysis)
            else:
                logger.warning(f"    跳过非图片素材: {mat_type_str}")
                continue

            items.append(item)
            # 打印关键信息
            tags = ", ".join(item.tags[:5])
            logger.info(f"     → {item.description[:50]} | 质量:{item.quality.value} | 标签:{tags}")
        except Exception as e:
            logger.error(f"    失败: {e}")
            fail_count += 1

    # 保存库存
    inventory = MaterialInventory(items=items)
    out.save_json("material", "inventory.json", inventory)
    logger.info(f"\n入库完成: {len(items)}/{total} 成功 (失败 {fail_count})")
    logger.info(f"  含人脸: {sum(1 for i in items if i.has_face)} 张")
    logger.info(f"  质量分布: {sum(1 for i in items if i.quality.value == 'high')}高 / "
                f"{sum(1 for i in items if i.quality.value == 'medium')}中 / "
                f"{sum(1 for i in items if i.quality.value == 'low')}低")

    items_json = [i.to_dict() if hasattr(i, "to_dict") else str(i) for i in items]
    out.save_json("material", "items_summary.json", items_json)
    logger.info(f"\n素材清单已保存至: {out.run_dir / 'material'}")


if __name__ == "__main__":
    asyncio.run(main())
