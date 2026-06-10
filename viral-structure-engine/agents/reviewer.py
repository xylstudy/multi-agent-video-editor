import json
import logging
from typing import Optional

from agents.base import BaseAgent, AgentRole, AgentResult
from prompts.reviewer_prompts import build_review_prompt

logger = logging.getLogger(__name__)


class ReviewerAgent(BaseAgent):
    def __init__(self, llm):
        super().__init__(llm)
        self.role = AgentRole.REVIEWER
        self.system_prompt = """你是一位严苛但公正的Vlog审核专家。

审核标准：
- Vlog生死在前3秒，hook不行后面全白搭
- 需要"呼吸感"——不能全程快切也不能全程慢
- 情绪一致性比内容丰富度更重要
- 最怕"假"和"刻意"
- 文字卡在Vlog中完全合法

工具列表：
- review_scheme: 对方案做8维度质量评估
- done: 任务完成"""

        self.tools = {
            "review_scheme": self._review_scheme,
            "done": self._done,
        }

    def _build_observe_prompt(self, state: dict, history: list) -> str:
        task = state.get("current_task", {})
        parts = [f"任务：{task.get('task_description', '审核方案')}"]
        scheme = state.get("scheme")
        if scheme:
            sb = getattr(scheme, "storyboard", [])
            parts.append(f"方案：{len(sb)}个分镜")
        parts.append(f"已执行 {len(history)} 步")
        return "\n".join(parts)

    async def _review_scheme(self, source_structure_summary: str, scheme_json: str,
                              material_coverage_desc: str,
                              material_list_desc: str = "",
                              transition_summary: str = "") -> dict:
        prompt = build_review_prompt(
            source_structure_summary, scheme_json, material_coverage_desc,
            material_list_desc=material_list_desc,
            transition_summary=transition_summary,
        )
        response = await self.llm.chat(prompt, response_format="json")
        return self.llm.parse_json(response)

    async def _done(self, summary: str) -> dict:
        return {"status": "done", "summary": summary}
