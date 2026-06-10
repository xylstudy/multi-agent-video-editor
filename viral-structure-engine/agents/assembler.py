import json
import logging
import subprocess
import sys
from pathlib import Path
from typing import Optional

from agents.base import BaseAgent, AgentRole, AgentResult
from config import settings

logger = logging.getLogger(__name__)

REMOTION_DIR = Path(__file__).resolve().parent.parent / "remotion"
RENDER_SCRIPT = REMOTION_DIR / "src/Root.tsx"
RENDER_COMPOSITION = "VideoScheme"


class AssemblerAgent(BaseAgent):
    def __init__(self, llm):
        super().__init__(llm)
        self.role = AgentRole.ASSEMBLER
        self.system_prompt = """你是Vlog合成师。你的工作是把编导制定的方案和准备好的素材，合成一条完整的Vlog视频。

工具列表：
- render_with_remotion: 用 Remotion 渲染完整视频（支持转场、字幕、Ken Burns 等）
- render_fallback: 如果 Remotion 不可用，用 FFmpeg 简单拼接
- done: 任务完成"""

        self.tools = {
            "render_with_remotion": self._render_with_remotion,
            "render_fallback": self._render_fallback,
            "done": self._done,
        }

    def _build_observe_prompt(self, state: dict, history: list) -> str:
        scheme = state.get("scheme")
        parts = [f"任务：{state.get('current_task', {}).get('task_description', '合成视频')}"]
        if scheme:
            sb = getattr(scheme, "storyboard", [])
            parts.append(f"方案：{len(sb)}个分镜，目标{getattr(scheme, 'target_duration', 60)}秒")
        parts.append(f"已执行 {len(history)} 步")
        return "\n".join(parts)

    def _build_input_props(self, state: dict) -> dict:
        """把 state 中的 scheme + material_inventory 序列化为 Remotion inputProps"""
        scheme = state.get("scheme")
        if not scheme:
            raise ValueError("没有方案可渲染")

        scheme_dict = (
            scheme.to_dict() if hasattr(scheme, "to_dict") else scheme
        )

        # 构建素材路径映射: material_id → 本地文件路径
        material_map = {}
        inventory = state.get("material_inventory")
        if inventory:
            items = getattr(inventory, "items", getattr(inventory, "materials", []))
            for m in items:
                mid = getattr(m, "id", "")
                mpath = getattr(m, "path", "")
                if mid and mpath:
                    material_map[mid] = str(Path(mpath).resolve())

        # 把 storyboard 中的 material_id 对齐
        for frame in scheme_dict.get("storyboard", []):
            mid = frame.get("material_id") or frame.get("source_material_id", "")
            if mid and mid not in material_map:
                # 如果素材不在 map 里，可能是生成素材（文字卡等），标记一下
                frame["is_generated"] = True

        return {
            "scheme": scheme_dict,
            "material_map": material_map,
        }

    async def _render_with_remotion(self, output_path: str = "") -> dict:
        """用 Remotion 渲染完整视频"""
        if not REMOTION_DIR.exists():
            return {"success": False, "error": f"Remotion 项目目录不存在: {REMOTION_DIR}"}

        is_windows = sys.platform == "win32"
        npx_cmd = "npx.cmd" if is_windows else "npx"
        remotion_entry = RENDER_SCRIPT.resolve().as_posix()

        output = output_path or str(settings.OUTPUT_DIR / "vlog.mp4")
        output_path_obj = Path(output)
        output_path_obj.parent.mkdir(parents=True, exist_ok=True)

        # 写 inputProps JSON
        input_props = self._build_input_props(self._tool_results)
        props_file = REMOTION_DIR / f"input_props_{abs(hash(json.dumps(input_props, sort_keys=True)))}.json"
        props_file.write_text(json.dumps(input_props, ensure_ascii=False), encoding="utf-8")

        cmd = [
            npx_cmd, "remotion", "render",
            remotion_entry,
            RENDER_COMPOSITION,
            output,
            "--props", str(props_file),
            "--overwrite",
        ]

        if not is_windows:
            cmd = ["timeout", "300"] + cmd  # 5 分钟超时

        logger.info(f"Remotion 渲染命令: {' '.join(cmd)}")
        logger.info(f"  inputProps: {props_file}")
        logger.info(f"  分镜数: {len(input_props.get('scheme', {}).get('storyboard', []))}")
        logger.info(f"  素材数: {len(input_props.get('material_map', {}))}")

        try:
            result = subprocess.run(
                cmd,
                cwd=str(REMOTION_DIR),
                capture_output=True,
                text=True,
                timeout=600,  # 10 分钟超时
            )

            if result.returncode != 0:
                stderr = result.stderr[-1000:] if result.stderr else ""
                logger.error(f"Remotion 渲染失败: {stderr}")
                return {"success": False, "error": stderr, "fallback": True}

            logger.info(f"Remotion 渲染完成: {output}")
            props_file.unlink(missing_ok=True)
            return {"success": True, "output_path": output, "method": "remotion"}

        except subprocess.TimeoutExpired:
            logger.error("Remotion 渲染超时")
            return {"success": False, "error": "渲染超时", "fallback": True}
        except FileNotFoundError:
            logger.error("npx 未找到，尝试回退拼接")
            return {"success": False, "error": "npx not found", "fallback": True}

    async def _render_fallback(self, output_path: str = "") -> dict:
        """如果 Remotion 不可用，用 FFmpeg 简单拼接素材"""
        from tools.video_tools import VideoTools

        video = VideoTools()
        scheme = None
        for val in self._tool_results.values():
            if isinstance(val, dict) and "scheme" in val:
                scheme = val["scheme"]
                break

        if not scheme:
            # 从 state 读
            return {"success": False, "error": "没有可用的方案"}

        material_map = {}
        inventory = None
        for val in self._tool_results.values():
            if isinstance(val, dict) and "material_inventory" in val:
                inventory = val["material_inventory"]
                break

        if inventory:
            items = getattr(inventory, "items", getattr(inventory, "materials", []))
            for m in items:
                mid = getattr(m, "id", "")
                mpath = getattr(m, "path", "")
                if mid and mpath:
                    material_map[mid] = mpath

        storyboard = scheme.get("storyboard", [])
        clip_paths = []
        for frame in storyboard:
            mid = frame.get("material_id") or frame.get("source_material_id", "")
            if mid and mid in material_map:
                clip_paths.append(material_map[mid])

        if not clip_paths:
            return {"success": False, "error": "没有可拼接的素材"}

        output = output_path or str(settings.OUTPUT_DIR / "vlog_fallback.mp4")
        try:
            merged = video.concat_clips(clip_paths)
            import shutil
            shutil.copy2(merged, output)
            return {"success": True, "output_path": output, "method": "ffmpeg_fallback"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _done(self, summary: str) -> dict:
        return {"status": "done", "summary": summary}

    async def execute(self, state: dict) -> AgentResult:
        """覆写基类的 execute，直接用 Remotion 渲染"""
        self._step_history = []
        self._tool_results = {}

        # 尝试 Remotion
        render_result = await self._render_with_remotion()
        if render_result.get("success"):
            return AgentResult(
                success=True,
                data={"rendered_video_path": render_result["output_path"]},
                message=f"Remotion 渲染完成: {render_result['output_path']}",
            )

        # Remotion 失败，回退到 FFmpeg
        if render_result.get("fallback"):
            logger.warning("Remotion 不可用，回退到 FFmpeg 拼接")
            fallback_result = await self._render_fallback()
            if fallback_result.get("success"):
                return AgentResult(
                    success=True,
                    data={"rendered_video_path": fallback_result["output_path"]},
                    message=f"FFmpeg 拼接完成: {fallback_result['output_path']}",
                )
            return AgentResult(
                success=False,
                data={},
                message=fallback_result.get("error", "渲染失败"),
            )

        return AgentResult(
            success=False,
            data={},
            message=render_result.get("error", "渲染失败"),
        )
