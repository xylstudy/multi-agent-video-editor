"""单独测试 GLM-4.6V 视频画面理解能力"""
import argparse
import asyncio
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

from config.llm_client import LLMTools
from config import settings
from tools.video_tools import VideoTools

PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_VIDEO_PATH = PROJECT_ROOT / "data" / "samples" / "viral.mp4"


def parse_args():
    parser = argparse.ArgumentParser(description="单独测试 GLM-4.6V 视频画面理解能力")
    parser.add_argument(
        "--video",
        type=str,
        default=str(DEFAULT_VIDEO_PATH),
        help="待测试视频路径（默认: data/samples/viral.mp4）",
    )
    parser.add_argument(
        "--topic",
        type=str,
        default="北京旅行Vlog",
        help="视频主题（默认: 北京旅行Vlog）",
    )
    return parser.parse_args()


async def main():
    args = parse_args()
    video_path = args.video

    # 1. 初始化 LLM（智谱 GLM-4.6V）
    llm = LLMTools(
        api_key=settings.ZHIPU_API_KEY,
        base_url=settings.ZHIPU_BASE_URL,
        model="glm-4.6v",
    )
    video = VideoTools()

    # 2. 获取视频信息
    info = video.get_video_info(video_path)
    logger.info(f"视频信息: {info['duration']}s, {info['width']}x{info['height']}, {info['fps']}fps")

    # 3. 场景检测
    scenes = video.detect_scene_changes(video_path)
    logger.info(f"检测到 {len(scenes)} 个镜头")

    # 4. 只分析前 3 个镜头
    for i, scene in enumerate(scenes[:3]):
        logger.info(f"\n{'='*60}")
        logger.info(f"镜头 {i+1}: {scene['start']:.1f}s - {scene['end']:.1f}s")

        # 取中间帧
        mid_time = (scene['start'] + scene['end']) / 2
        frame_path = video.extract_frame(video_path, mid_time)
        logger.info(f"提取关键帧: {frame_path}")

        # 发给 GLM-4.6V
        prompt = f"""请分析这个镜头在Vlog中的结构和作用。

镜头信息：
- 镜头序号: {i}
- 时间范围: {scene['start']:.1f}s - {scene['end']:.1f}s
- 视频总时长: {info['duration']:.1f}s
- 视频主题: {args.topic}

请分析：
1. 画面内容（main_subject、people_count、场景描述）
2. 拍摄技法（camera_movement、shot_size、composition）
3. 结构功能（primary_function: hook/scene_establish/daily_moment/emotion_peak/persona_expression/info_card/closing_moment/transition）
4. 情感标签
5. 一句话摘要
6. 标签

以JSON格式返回。"""

        logger.info(f"发送给 GLM-4.6V...")
        try:
            response = await llm.chat_with_images(prompt, [frame_path], response_format="json")
            logger.info(f"原始响应长度: {len(response)} 字符")
            logger.info(f"原始响应前200字: {response[:200]}")

            result = llm.parse_json(response)
            logger.info(f"解析成功!")
            logger.info(json.dumps(result, ensure_ascii=False, indent=2))
        except Exception as e:
            logger.error(f"失败: {e}")
            # 重试一次，不加 response_format
            logger.info("无 JSON 格式重试...")
            response = await llm.chat_with_images(prompt, [frame_path], response_format="")
            logger.info(f"重试响应前200字: {response[:200]}")

    logger.info("\n测试完成!")


if __name__ == "__main__":
    asyncio.run(main())
