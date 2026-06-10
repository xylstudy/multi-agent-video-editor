import json
import logging
from dataclasses import dataclass, field
from typing import Any, Optional

from agents.base import BaseAgent, AgentRole, AgentResult, AgentStep
from graph.state import ViralEngineState

logger = logging.getLogger(__name__)


class SupervisorAgent(BaseAgent):
    def __init__(self, llm):
        super().__init__(llm)
        self.role = AgentRole.SUPERVISOR
        self.system_prompt = """你是一位Vlog创作团队的项目经理（Supervisor）。你管理着一个由专家Agent组成的团队，负责协调他们的工作。

你的团队：
- analyst: 视频分析专家 — 分析爆款Vlog的结构、节奏、包装
- material_manager: 素材管家 — 入库和理解用户素材，识别缺口
- planner: 编导策划师 — 制定Vlog迁移方案
- creative: 创作补全师 — 用策略补全素材缺口
- renderer: 渲染工程师 — 分析方案渲染策略，生成自定义React组件
- assembler: 合成师 — 用Remotion渲染最终视频
- reviewer: 审核评估师 — 评估方案质量

你的工作方式：
1. 查看当前全局状态，判断需要哪个专家
2. 给专家下发任务（写入 current_task）
3. 等待专家完成后，检查结果
4. 判断是否继续或结束

决策原则：
- 首先分析爆款，再处理素材，再出方案，再定渲染策略，再补缺口，再合成，最后审核
- 如果审核不通过且未超迭代次数，回到 planner 优化
- 如果出现错误，判断是重试还是跳过
- 不要一次性把所有专家都叫出来，一步步来"""

    def _build_observe_prompt(self, state: dict, history: list) -> str:
        phase = state.get("phase", "init")
        iteration = state.get("iteration", 0)
        max_iter = state.get("max_iterations", 3)
        structures = state.get("source_structures", [])
        scheme = state.get("scheme")
        review = state.get("review_result", {})

        parts = [f"当前阶段: {phase}", f"迭代: {iteration}/{max_iter}"]

        if structures:
            parts.append(f"已分析爆款: {len(structures)} 条")
        if state.get("material_inventory"):
            inv = state["material_inventory"]
            items = getattr(inv, "items", getattr(inv, "materials", []))
            gaps = getattr(inv, "gaps", [])
            parts.append(f"素材: {len(items)} 个, 缺口: {len(gaps)} 个")
        if scheme:
            storyboard = getattr(scheme, "storyboard", [])
            parts.append(f"方案: {len(storyboard)} 个分镜")
        if review:
            parts.append(f"审核结果: 总分={review.get('total_score', 'N/A')}, 通过={review.get('pass', False)}")

        parts.append(f"历史决策数: {len(history)}")
        return "\n".join(parts)

    async def decide_next(self, state: ViralEngineState) -> dict:
        self._step_history = []

        # === Hard routing: skip LLM decision when phase is unambiguous ===
        phase = state.get("phase", "init")
        structures = state.get("source_structures", [])
        sample_videos = state.get("sample_videos", [])
        scheme = state.get("scheme")
        inventory = state.get("material_inventory")

        if phase == "materials" and structures:
            return {
                "thought": f"Done {len(structures)} videos, phase=materials -> material_manager",
                "next_expert": "material_manager",
                "task_description": "入库和理解用户素材，识别缺口",
                "reasoning": f"{len(structures)}/{len(sample_videos)} videos analyzed, phase=materials"
            }
        if phase == "planning":
            iteration = state.get("iteration", 0)
            if iteration > 0 and scheme:
                return {
                    "thought": f"Review iteration {iteration}, phase=planning -> planner",
                    "next_expert": "planner",
                    "task_description": f"迭代优化方案 (第{iteration+1}轮)",
                    "reasoning": f"iteration={iteration}, scheme exists, need optimization"
                }
            if scheme:
                return {
                    "thought": "Scheme exists, phase=planning -> renderer",
                    "next_expert": "renderer",
                    "task_description": "分析方案渲染策略，生成自定义组件",
                    "reasoning": "scheme ready, phase=planning"
                }
            if inventory:
                return {
                    "thought": "Inventory ready, phase=planning -> planner",
                    "next_expert": "planner",
                    "task_description": "生成Vlog迁移方案",
                    "reasoning": "inventory ready, need scheme, phase=planning"
                }
        if phase == "renderer" and scheme:
            return {
                "thought": "Scheme analyzed, phase=renderer -> renderer node",
                "next_expert": "renderer",
                "task_description": "分析方案渲染策略，生成自定义组件",
                "reasoning": "scheme exists, phase=renderer"
            }
        if phase == "gaps" and scheme:
            return {
                "thought": "Renderer done, phase=gaps -> creative",
                "next_expert": "creative",
                "task_description": "补全素材缺口",
                "reasoning": "phase=gaps, need to fill material gaps"
            }
        if phase == "assemble":
            return {
                "thought": "Gaps handled, phase=assemble -> assembler",
                "next_expert": "assembler",
                "task_description": "用Remotion渲染最终视频",
                "reasoning": "phase=assemble, ready to render"
            }
        if phase == "review":
            return {
                "thought": "Video rendered or scheme ready, phase=review -> reviewer",
                "next_expert": "reviewer",
                "task_description": "审核方案质量",
                "reasoning": "phase=review, need quality check"
            }
        if phase == "complete":
            return {
                "thought": "All done, phase=complete -> END",
                "next_expert": "__end__",
                "task_description": "",
                "reasoning": "phase=complete, workflow finished"
            }

        prompt = self._build_observe_prompt(state, [])

        expert_descriptions = """
专家列表（返回时用 name 字段）：
- analyst: 分析爆款Vlog的结构。当前有一条或多条未分析的视频在 sample_videos 中。条件是 source_structures 为空或还有未分析的视频。
- material_manager: 入库和理解用户素材。条件是 source_structures 不为空且 material_inventory 为空或需更新。
- planner: 生成/迭代Vlog迁移方案。条件是 material_inventory 不为空且 scheme 为空或需迭代。
- renderer: 分析方案渲染策略，生成自定义React组件
- creative: 补全素材缺口。条件是 scheme 不为空且 gap_report 中有未补的缺口。
- assembler: 用Remotion渲染最终视频。条件是 scheme 不为空且所有缺口已处理。
- reviewer: 审核方案质量。条件是 scheme 不为空且未审核。
- __end__: 所有工作完成，结束流程。"""

        decision_prompt = f"""当前状态：
{prompt}

{expert_descriptions}

请根据当前状态，决定下一步让哪个专家工作。用JSON格式输出：

{{
  "thought": "你对当前状态的分析",
  "next_expert": "analyst / material_manager / planner / renderer / creative / assembler / reviewer / __end__",
  "task_description": "给该专家下发的任务描述",
  "reasoning": "为什么选择这个专家"
}}"""

        response = await self.llm.chat(
            decision_prompt,
            system=self.system_prompt,
            response_format="json",
        )
        return self.llm.parse_json(response)
