import json
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

from config.llm_client import LLMTools

logger = logging.getLogger(__name__)


class AgentRole(str, Enum):
    SUPERVISOR = "supervisor"
    ANALYST = "analyst"
    PLANNER = "planner"
    MATERIAL_MANAGER = "material_manager"
    CREATIVE = "creative"
    ASSEMBLER = "assembler"
    REVIEWER = "reviewer"
    KNOWLEDGE = "knowledge"
    RENDERER = "renderer"


@dataclass
class AgentStep:
    step_index: int
    thought: str = ""
    action: str = ""
    action_input: dict = field(default_factory=dict)
    observation: str = ""
    is_final: bool = False


@dataclass
class AgentResult:
    success: bool = True
    data: Any = None
    message: str = ""
    steps: list[AgentStep] = field(default_factory=list)


class BaseAgent(ABC):
    role: AgentRole
    system_prompt: str = ""
    tools: dict[str, callable] = {}

    def __init__(self, llm: Optional[LLMTools] = None):
        self.llm = llm or LLMTools()
        self._step_history: list[AgentStep] = []
        self._tool_results: dict[str, Any] = {}

    @abstractmethod
    def _build_observe_prompt(self, state: dict, history: list[AgentStep]) -> str:
        ...

    async def execute(self, state: dict) -> AgentResult:
        self._step_history = []
        self._tool_results = {}
        max_steps = 15

        for step_idx in range(max_steps):
            observe_prompt = self._build_observe_prompt(state, self._step_history)
            tool_list = "\n".join(f"  - {name}: {fn.__doc__ or ''}" for name, fn in self.tools.items())

            decision_prompt = f"""当前任务上下文：
{observe_prompt}

可用工具：
{tool_list}

已执行的步骤：
{self._format_history()}

请决定下一步。如果任务已完成，请使用 "done" 工具。
用JSON格式输出你的思考过程：
{{
  "thought": "你当前对任务状态的分析和下一步判断",
  "action": "要调用的工具名，或 'done'",
  "action_input": {{"参数名": "参数值"}},
  "is_final": false
}}"""

            try:
                response = await self.llm.chat(
                    decision_prompt,
                    system=self.system_prompt,
                    response_format="json",
                )
                decision = self.llm.parse_json(response)
            except Exception as e:
                logger.error(f"Agent {self.role} decision error: {e}")
                break

            thought = decision.get("thought", "")
            action = decision.get("action", "")
            action_input = decision.get("action_input", {})
            is_final = decision.get("is_final", False)

            # 输出 Agent 步骤进度
            if is_final or action == "done":
                logger.info(f"  [{self.role.value}] [OK] {thought[:80]}")
            else:
                inp_summary = json.dumps(action_input, ensure_ascii=False)[:60]
                logger.info(f"  [{self.role.value}] → {action}({inp_summary})")

            step = AgentStep(
                step_index=step_idx,
                thought=thought,
                action=action,
                action_input=action_input,
                is_final=is_final,
            )

            if is_final or action == "done":
                step.observation = f"任务完成: {action_input.get('summary', '')}"
                self._step_history.append(step)
                return AgentResult(
                    success=True,
                    data=self._tool_results,
                    message=action_input.get("summary", ""),
                    steps=self._step_history,
                )

            tool_fn = self.tools.get(action)
            if tool_fn is None:
                step.observation = f"错误：未知工具 '{action}'"
                self._step_history.append(step)
                continue

            try:
                result = await tool_fn(**action_input)
                summary = str(result)[:500]
                step.observation = summary
                self._tool_results[f"step_{step_idx}_{action}"] = result
            except Exception as e:
                step.observation = f"工具执行失败: {e}"
                logger.warning(f"Tool {action} failed: {e}")

            self._step_history.append(step)

        return AgentResult(
            success=False,
            data=self._tool_results,
            message="超过最大步骤数",
            steps=self._step_history,
        )

    def _format_history(self) -> str:
        lines = []
        for s in self._step_history:
            lines.append(f"  步骤{s.step_index}: {s.action} → {s.observation[:100]}")
        return "\n".join(lines) if lines else "  尚无步骤"

    def _get_tool_result(self, key: str) -> Any:
        return self._tool_results.get(key)
