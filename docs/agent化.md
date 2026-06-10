# 爆款Vlog结构迁移引擎 — Agent 架构技术规格 v2

> 本文档是项目的唯一参考源。基于 Agent 架构（非 Workflow），以 Vlog 为切入点。

---

## 一、系统概述

### 1.1 系统定位

从爆款 Vlog 中提取创作方法论，迁移到用户新素材上，生成结构完整的新 Vlog。系统以 **Supervisor Agent 为大脑、六个专家 Agent 为执行者**，通过 ReAct 循环实现自主决策和迭代优化。

### 1.2 架构范式：Agent 系统

```
核心思想：
  给一个目标 + 一组能力 + 一份共享记忆，让系统自己想办法完成任务。

  Supervisor（项目经理）—— 看全局、做决策、调度专家
  专家 Agent（执行者）—— 各有专长和工具，接到任务后自主完成
  共享记忆（State）—— 所有 Agent 读写的公共信息库，不是流水线传送带
```

与 Workflow 的本质区别：

| | Workflow | 本系统（Agent） |
|---|---|---|
| 流程控制 | 预定义的图结构 | Supervisor LLM 动态决策 |
| 路由逻辑 | if/else 规则 | LLM 看全局状态后自主判断 |
| 每个节点 | 固定执行逻辑 | 内部 ReAct 循环，自主决策 |
| 遇到意外 | 走预设降级路径 | Agent 自己想办法解决 |
| 新增能力 | 改代码+改图结构 | 给 Agent 加一个工具即可 |

### 1.3 技术栈

| 层面 | 选型 |
|------|------|
| Agent 编排 | LangGraph (Python) |
| LLM | Doubao-Seed-2.0-lite（火山方舟） |
| 视频处理 | FFmpeg + OpenCV |
| 人脸检测 | face_recognition / OpenCV Haar |
| 语音转写 | Whisper（本地） |
| 视频渲染 | Phase 1 FFmpeg → Phase 3 Remotion |
| 知识库 | Phase 4 Chroma / FAISS |

---

## 二、项目结构

```
viral-structure-engine/
│
├── graph/                              # LangGraph 图定义
│   ├── __init__.py
│   ├── state.py                        # 共享记忆（ViralEngineState）
│   └── builder.py                      # 图构建（Supervisor + 子Agent + 边）
│
├── agents/                             # Agent 定义
│   ├── __init__.py
│   ├── base.py                         # BaseAgent 基类（含 ReAct 循环）
│   ├── supervisor.py                   # Supervisor Agent（大脑）
│   ├── analyst.py                      # 视频分析专家
│   ├── material_manager.py             # 素材管理专家
│   ├── planner.py                      # 编导策划专家
│   ├── creative.py                     # 创作补全专家
│   ├── assembler.py                    # 视频合成专家
│   ├── reviewer.py                     # 审核评估专家
│   └── knowledge_agent.py              # 知识管理专家（Phase 4）
│
├── tools/                              # 工具集（Agent 共享的能力）
│   ├── __init__.py
│   ├── video_tools.py                  # FFmpeg 相关工具
│   ├── face_tools.py                   # 人脸检测工具
│   ├── audio_tools.py                  # ASR/TTS 工具
│   ├── llm_tools.py                    # LLM 推理工具
│   ├── gen_tools.py                    # T2I/T2V 生成工具（Phase 2）
│   └── render_tools.py                 # Remotion 渲染工具（Phase 3）
│
├── models/                             # 数据模型
│   ├── __init__.py
│   ├── video_structure.py
│   ├── material.py
│   ├── scheme.py
│   └── knowledge.py
│
├── prompts/                            # Prompt 模板
│   ├── __init__.py
│   ├── supervisor_prompts.py           # Supervisor 决策 Prompt
│   ├── analyst_prompts.py
│   ├── material_prompts.py
│   ├── planner_prompts.py
│   ├── creative_prompts.py
│   ├── reviewer_prompts.py
│   └── knowledge_prompts.py            # Phase 4
│
├── knowledge/                          # 知识库（Phase 4）
│   ├── __init__.py
│   ├── store.py
│   └── extractor.py
│
├── config/
│   ├── __init__.py
│   └── settings.py
│
├── data/
│   ├── samples/
│   ├── assets/
│   ├── output/
│   ├── temp/
│   └── knowledge_db/
│
├── tests/
│   ├── test_supervisor.py
│   ├── test_agents.py
│   └── test_pipeline.py
│
├── main.py
├── pyproject.toml
└── README.md
```

与 v1 的主要结构差异：

```
删除：  graph/nodes/（所有固定节点文件）
删除：  graph/routes.py（规则路由函数）
删除：  services/（被 tools/ 替代）
新增：  agents/supervisor.py
新增：  tools/（独立的工具层，Agent 共享调用）
修改：  agents/base.py（加入 ReAct 循环基类）
修改：  graph/builder.py（Agent 图替代节点图）
```

---

## 三、数据模型

### 3.1 共享记忆 State

```python
# graph/state.py
from typing import TypedDict, Any


class ViralEngineState(TypedDict):
    """所有 Agent 共享的工作记忆，不是流水线传送带"""

    # ===== 用户输入 =====
    sample_videos: list[str]            # 爆款视频路径
    user_materials: list[dict]          # 用户素材
    target_topic: str                   # 新 Vlog 主题
    target_info: dict                   # 主题详情
    user_preferences: dict              # 用户偏好

    # ===== Vlog 专属输入 =====
    domain: str                         # "vlog"
    vlog_style_preference: str          # 风格偏好
    narrative_type_hint: str            # 叙事类型提示
    persona_config: dict                # 人物出镜配置

    # ===== 共享工作区 =====
    # 这些字段由各个 Agent 按需读写，不是按固定顺序传递
    source_structures: list             # [VideoStructure, ...]
    material_inventory: Any             # MaterialInventory
    scheme: Any                         # VideoScheme
    knowledge_refs: list                # [KnowledgeEntry, ...]
    gap_report: dict                    # 缺口报告
    generated_materials: list           # AI 生成的素材
    rendered_video_path: str            # 合成视频路径
    review_result: dict                 # 审核结果

    # ===== Agent 通信区 =====
    # Supervisor 和子 Agent 之间传递任务和结果
    current_task: dict                  # Supervisor 下发的当前任务
    last_result: dict                   # 子 Agent 上报的最新结果

    # ===== 流程控制 =====
    phase: str                          # 当前阶段标识
    iteration: int                      # 迭代轮次
    max_iterations: int                 # 最大迭代次数
    is_complete: bool                   # 任务是否完成
    errors: list[str]
    logs: list[dict]                    # 所有 Agent 的决策日志
```

### 3.2 models/video_structure.py

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class ShotType(str, Enum):
    # 通用
    HOOK = "hook"
    CTA = "cta"
    TRANSITION = "transition"
    # Vlog 专用
    SCENE_ESTABLISH = "scene_establish"
    DAILY_MOMENT = "daily_moment"
    EMOTION_PEAK = "emotion_peak"
    PERSONA_EXPRESSION = "persona"
    INFO_CARD = "info_card"
    CLOSING_MOMENT = "closing"
    # 预留
    PAIN_POINT = "pain_point"
    PRODUCT_SHOW = "product"
    USAGE_DEMO = "usage"
    COMPARISON = "comparison"


class TransitionType(str, Enum):
    CUT = "cut"
    FADE = "fade"
    DISSOLVE = "dissolve"
    ZOOM_IN = "zoom_in"
    ZOOM_OUT = "zoom_out"
    FLASH_WHITE = "flash_white"
    SLIDE = "slide"
    WHIP = "whip"
    MASK = "mask"
    NONE = "none"


@dataclass
class ShotInfo:
    index: int
    start_time: float
    end_time: float
    duration: float
    shot_type: ShotType
    visual_description: str = ""
    camera_movement: str = ""
    shot_size: str = ""
    composition: str = ""
    color_mood: str = ""
    subtitle_text: str = ""
    voiceover_text: str = ""
    transition_in: TransitionType = TransitionType.CUT
    emotion: str = ""
    structure_purpose: str = ""
    has_face: bool = False
    bgm_sync: bool = False
    is_empty_shot: bool = False


@dataclass
class RhythmPoint:
    time: float
    intensity: float
    avg_shot_duration: float = 0
    note: str = ""


@dataclass
class SubtitleStyle:
    font_family: str = ""
    font_size: int = 0
    color: str = ""
    stroke_color: str = ""
    stroke_width: int = 0
    shadow: bool = False
    bg_color: Optional[str] = None
    background_style: str = "none"
    position: str = "bottom"
    animation: str = "none"
    typing_speed: float = 0
    max_chars_per_line: int = 15
    line_spacing: float = 1.2


@dataclass
class PackagingStyle:
    subtitle_style: SubtitleStyle = field(default_factory=SubtitleStyle)
    title_card_style: str = ""
    text_card_background: str = ""
    text_card_font: str = ""
    preferred_transitions: list[str] = field(default_factory=list)
    transition_frequency: str = "moderate"
    color_grade: str = ""
    filter_style: str = ""
    visual_mood: str = ""
    emphasis_elements: list[str] = field(default_factory=list)
    sticker_types: list[str] = field(default_factory=list)
    color_palette: list[str] = field(default_factory=list)
    default_ken_burns: str = "slow_zoom_in"


@dataclass
class BGMInfo:
    style: str = ""
    bpm: int = 0
    mood: str = ""
    beat_points: list[float] = field(default_factory=list)
    role: str = "background"
    reference_track: str = ""


@dataclass
class VlogMeta:
    narrative_type: str = ""
    structure_type: str = ""
    persona_type: str = ""
    persona_ratio: float = 0
    hook_method: str = ""
    hook_detail: str = ""
    empty_shot_count: int = 0
    empty_shot_ratio: float = 0
    emotion_arc: list[dict] = field(default_factory=list)
    overall_emotion: str = ""
    key_techniques: list[str] = field(default_factory=list)


@dataclass
class ScriptBlock:
    index: int
    shot_type: ShotType
    purpose: str
    text: str
    duration_hint: float = 0
    emotion: str = ""


@dataclass
class VideoStructure:
    source_id: str
    source_path: str
    duration: float = 0
    resolution: tuple[int, int] = (1080, 1920)
    aspect_ratio: str = "9:16"
    shots: list[ShotInfo] = field(default_factory=list)
    script_blocks: list[ScriptBlock] = field(default_factory=list)
    rhythm_curve: list[RhythmPoint] = field(default_factory=list)
    packaging: PackagingStyle = field(default_factory=PackagingStyle)
    bgm: BGMInfo = field(default_factory=BGMInfo)
    full_transcript: str = ""
    hook_summary: str = ""
    structure_summary: str = ""
    key_techniques: list[str] = field(default_factory=list)
    category: str = ""
    platform: str = ""
    vlog_meta: Optional[VlogMeta] = None
```

### 3.3 models/material.py

```python
from dataclasses import dataclass, field
from enum import Enum
from models.video_structure import ShotType


class MaterialType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    TEXT = "text"


class MaterialQuality(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNUSABLE = "unusable"


@dataclass
class MaterialItem:
    id: str
    type: MaterialType
    path: str
    description: str = ""
    main_subject: str = ""
    tags: list[str] = field(default_factory=list)
    duration: float = 0
    width: int = 0
    height: int = 0
    quality: MaterialQuality = MaterialQuality.MEDIUM
    quality_notes: str = ""
    suitable_for: list[ShotType] = field(default_factory=list)
    emotion_label: str = ""
    scene_type: str = ""
    light_quality: str = ""
    has_face: bool = False
    face_count: int = 0
    main_face_region: tuple = ()
    suggested_motion: str = ""
    highlight_clips: list[dict] = field(default_factory=list)
    has_usable_audio: bool = False
    is_ai_generated: bool = False
    generation_prompt: str = ""
    source_gap_index: int = -1
    metadata: dict = field(default_factory=dict)


@dataclass
class MaterialGap:
    slot_index: int
    required_type: ShotType
    purpose: str
    needed_content: str
    priority: int = 3
    impact_if_not_filled: str = ""
    suggested_strategy: str = ""
    strategy_detail: str = ""
    alternative_strategies: list[str] = field(default_factory=list)
    is_filled: bool = False
    filled_by: str = ""
    filled_material_id: str = ""
    fill_quality: str = ""


@dataclass
class MaterialInventory:
    items: list[MaterialItem] = field(default_factory=list)
    gaps: list[MaterialGap] = field(default_factory=list)
    coverage_rate: float = 0
    face_material_count: int = 0
    scene_material_count: int = 0
    text_material_count: int = 0

    def get_filled_gaps(self):
        return [g for g in self.gaps if g.is_filled]

    def get_unfilled_gaps(self):
        return [g for g in self.gaps if not g.is_filled]

    def get_high_priority_gaps(self, threshold=3):
        return [g for g in self.gaps if not g.is_filled and g.priority >= threshold]

    def get_items_by_shot_type(self, shot_type):
        return [m for m in self.items if shot_type in m.suitable_for]

    def get_face_items(self):
        return [m for m in self.items if m.has_face]
```

### 3.4 models/scheme.py

```python
from dataclasses import dataclass, field
from typing import Optional
from models.video_structure import (
    ShotType, TransitionType, PackagingStyle, RhythmPoint
)


@dataclass
class StoryboardFrame:
    index: int
    start_time: float
    end_time: float
    duration: float
    purpose: str
    shot_type: ShotType = ShotType.DAILY_MOMENT
    visual_content: str = ""
    material_id: str = ""
    is_generated: bool = False
    subtitle_text: str = ""
    voiceover_text: str = ""
    text_card_content: str = ""
    text_card_style: dict = field(default_factory=dict)
    transition: TransitionType = TransitionType.CUT
    camera_note: str = ""
    motion_effect: str = ""
    packaging_note: str = ""
    emotion: str = ""
    rhythm_intensity: float = 0.5
    bgm_sync: bool = False
    gap_filled: bool = False
    gap_fill_strategy: str = ""


@dataclass
class VideoScheme:
    id: str
    title: str = ""
    source_structure_ids: list[str] = field(default_factory=list)
    target_topic: str = ""
    target_category: str = "vlog"
    target_duration: float = 0
    target_platform: str = "抖音"
    narrative_type: str = ""
    structure_type: str = ""
    hook_strategy: str = ""
    emotion_arc: list[dict] = field(default_factory=list)
    overall_emotion: str = ""
    script_blocks: list[dict] = field(default_factory=list)
    storyboard: list[StoryboardFrame] = field(default_factory=list)
    rhythm_curve: list[RhythmPoint] = field(default_factory=list)
    bgm_suggestion: dict = field(default_factory=dict)
    packaging: PackagingStyle = field(default_factory=PackagingStyle)
    color_grade: str = ""
    filter_style: str = ""
    material_ids: list[str] = field(default_factory=list)
    gap_ids: list[str] = field(default_factory=list)
    design_explanation: dict = field(default_factory=dict)
    version: int = 1
    status: str = "draft"
    review_notes: list[str] = field(default_factory=list)
    change_log: list[dict] = field(default_factory=list)
    render_path: Optional[str] = None
    render_config: dict = field(default_factory=dict)
```

### 3.5 models/knowledge.py

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class KnowledgeType(str, Enum):
    STRUCTURE_TEMPLATE = "structure_template"
    EDITING_TECHNIQUE = "editing_technique"
    PACKAGING_STYLE = "packaging_style"
    RHYTHM_PATTERN = "rhythm_pattern"
    CASE_INDEX = "case_index"
    INSIGHT = "insight"
    NARRATIVE_PATTERN = "narrative_pattern"
    HOOK_TECHNIQUE = "hook_technique"
    EMOTION_DESIGN = "emotion_design"
    EMPTY_SHOT_USAGE = "empty_shot_usage"
    PERSONA_STYLE = "persona_style"


@dataclass
class KnowledgeEntry:
    id: str
    type: KnowledgeType
    title: str
    content: str
    structured_data: dict = field(default_factory=dict)
    tags: list[str] = field(default_factory=list)
    source_ids: list[str] = field(default_factory=list)
    applicable_scenarios: list[str] = field(default_factory=list)
    confidence: float = 1.0
    usage_count: int = 0
    created_at: str = ""
    embedding: Optional[list[float]] = None
```

---

## 四、Tools 工具层

工具层是 Agent 共享的能力池。Agent 通过调用工具完成实际的视频处理、LLM 推理等操作。

```python
# tools/video_tools.py
"""FFmpeg + OpenCV 视频处理工具集"""

class VideoTools:
    def __init__(self, work_dir="./temp"):
        self.work_dir = work_dir

    def get_video_info(self, path) -> dict:
        """获取视频元信息：时长/分辨率/帧率"""

    def detect_scene_changes(self, path, threshold=0.3) -> list[dict]:
        """镜头切分，返回 [{start, end, duration}, ...]"""

    def extract_frame(self, path, time_sec) -> str:
        """抽取关键帧，返回图片路径"""

    def extract_audio(self, path) -> str:
        """抽取音频轨，返回 WAV 路径"""

    def apply_ken_burns(self, image_path, motion_type, speed, 
                        focus_region=None, duration=3.0) -> str:
        """Ken Burns 效果：zoom_in/zoom_out/pan_left/pan_right/focus_scan"""

    def generate_text_card(self, text, bg_color, font_style, 
                           text_color, animation, duration) -> str:
        """生成文字卡视频片段"""

    def apply_speed_change(self, path, factor) -> str:
        """变速：0.5=慢放一半，2.0=快放一倍"""

    def apply_reverse(self, path) -> str:
        """倒放"""

    def apply_basic_color_grade(self, path, config) -> str:
        """基础调色（brightness/contrast/saturation）"""

    def extract_highlight_clip(self, path, start, end) -> str:
        """截取高光片段"""

    def concat_clips(self, clips, transitions, transition_duration=0.5) -> str:
        """拼接片段+转场"""

    def overlay_subtitle(self, path, subtitle_config) -> str:
        """叠加字幕"""

    def crop_image(self, image_path, region) -> str:
        """裁切图片指定区域"""


# tools/face_tools.py
"""人脸检测工具"""

class FaceTools:
    def detect(self, image_path) -> list[dict]:
        """检测所有人脸，返回 [{bbox, confidence, area_ratio}]"""

    def has_face(self, image_path) -> bool:
        """是否有脸"""

    def get_main_face_region(self, image_path) -> Optional[tuple]:
        """最大人脸区域 (x,y,w,h)"""

    def get_face_crop(self, image_path, expand_ratio=1.5) -> str:
        """以人脸为中心裁切"""


# tools/audio_tools.py
"""音频工具"""

class AudioTools:
    def __init__(self, model_size="base"):
        # 加载 Whisper

    def transcribe(self, audio_path, language="zh") -> str:
        """语音转文字"""

    def transcribe_with_timestamps(self, audio_path, language="zh") -> list[dict]:
        """带时间戳的转写"""


# tools/llm_tools.py
"""LLM 工具"""

class LLMTools:
    def __init__(self, api_key, base_url, model):
        ...

    async def chat(self, prompt, system="", response_format="") -> str:
        """调用 LLM"""

    def parse_json(self, text) -> dict:
        """安全解析 JSON"""
```

---

## 五、Agent 定义

### 5.1 BaseAgent（含 ReAct 循环）

```python
# agents/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Optional
from enum import Enum


class AgentRole(str, Enum):
    SUPERVISOR = "supervisor"
    ANALYST = "analyst"
    PLANNER = "planner"
    MATERIAL_MANAGER = "material_manager"
    CREATIVE = "creative"
    ASSEMBLER = "assembler"
    REVIEWER = "reviewer"
    KNOWLEDGE = "knowledge"


@dataclass
class AgentStep:
    """ReAct 循环中单步的记录"""
    step_index: int
    thought: str           # 思考过程
    action: str            # 采取的行动
    action_input: dict     # 行动参数
    observation: str       # 行动结果
    is_final: bool         # 是否为最后一步


@dataclass
class AgentResult:
    """Agent 执行的最终结果"""
    success: bool
    data: Any = None
    message: str = ""
    steps: list[AgentStep] = None  # 完整的思考链路（可解释性关键）
    execution_time: float = 0

    def __post_init__(self):
        if self.steps is None:
            self.steps = []


class BaseAgent(ABC):
    """
    Agent 基类，内置 ReAct 循环。

    子类需要实现：
    - tools: Agent 可用的工具字典
    - system_prompt: Agent 的角色设定
    - _build_observe_prompt(): 构建观察描述
    - _build_act_prompt(): 构建行动决策 prompt
    - _execute_tool(): 执行工具调用
    - _should_stop(): 判断是否结束循环
    """

    def __init__(self, role: AgentRole, llm_tools):
        self.role = role
        self.llm = llm_tools
        self.tools: dict[str, callable] = {}  # 子类注册
        self.system_prompt: str = ""            # 子类定义
        self.max_steps: int = 10

    async def run(self, state: dict) -> dict:
        """
        Agent 的主入口：ReAct 循环。
        输入：完整的共享记忆 State
        输出：需要写回 State 的更新
        """
        steps = []
        state_updates = {}

        for i in range(self.max_steps):
            # Observe
            observation = self._build_observe_prompt(state, steps)

            # Think + Act
            decision = await self._think_and_act(observation, steps)

            step = AgentStep(
                step_index=i,
                thought=decision.get("thinking", ""),
                action=decision.get("action", ""),
                action_input=decision.get("params", {}),
                observation="",
                is_final=decision.get("action") == "done",
            )

            if step.is_final:
                step.observation = "任务完成"
                steps.append(step)
                state_updates = decision.get("state_updates", {})
                break

            # Execute tool
            tool_result = await self._execute_tool(step.action, step.action_input)
            step.observation = str(tool_result)[:500]
            steps.append(step)

            # 子类可以覆盖的后处理
            partial_update = self._process_step_result(step, tool_result)
            state_updates.update(partial_update)

        # 记录完整的思考链到日志
        state_updates.setdefault("logs", []).append({
            "agent": self.role.value,
            "steps": [{
                "thought": s.thought,
                "action": s.action,
                "observation": s.observation[:200],
            } for s in steps],
        })

        return state_updates

    async def _think_and_act(self, observation, history) -> dict:
        """调用 LLM 思考并决策下一步"""
        tools_desc = "\n".join([
            f"  - {name}: {getattr(func, '__doc__', '无描述')}"
            for name, func in self.tools.items()
        ])
        history_desc = "\n".join([
            f"  步骤{s.step_index}: 思考={s.thought} → 行动={s.action} → 结果={s.observation[:100]}"
            for s in history[-3:]
        ]) if history else "无历史记录"

        prompt = f"""{self.system_prompt}

【当前观察】
{observation}

【历史行动】
{history_desc}

【可用工具】
{tools_desc}
  - done: 任务完成，输出最终结果

请决定下一步行动。用JSON回答：
{{
  "thinking": "你的思考过程（为什么选择这个行动）",
  "action": "工具名 或 done",
  "params": {{"参数名": "参数值"}},
  "state_updates": {{}},
  "result_summary": "如果action=done，这里放最终结果摘要"
}}"""
        response = await self.llm.chat(prompt, response_format="json")
        return self.llm.parse_json(response)

    async def _execute_tool(self, tool_name, params) -> Any:
        """执行工具调用"""
        if tool_name not in self.tools:
            raise ValueError(f"工具 {tool_name} 不存在。可用工具：{list(self.tools.keys())}")
        tool = self.tools[tool_name]
        if asyncio.iscoroutinefunction(tool):
            return await tool(**params)
        return tool(**params)

    def _build_observe_prompt(self, state, history) -> str:
        """子类覆盖：构建观察描述"""
        return "子类需要覆盖此方法"

    def _process_step_result(self, step, result) -> dict:
        """子类覆盖：处理中间步骤结果"""
        return {}
```

### 5.2 Supervisor Agent

```python
# agents/supervisor.py

class SupervisorAgent(BaseAgent):
    """
    Supervisor 是整个系统的大脑。
    它不执行具体业务，而是观察全局状态，决定调用哪个专家 Agent。
    """

    def __init__(self, llm_tools, sub_agents: dict):
        super().__init__(AgentRole.SUPERVISOR, llm_tools)
        self.sub_agents = sub_agents  # {"analyst": AnalystAgent, ...}
        self.system_prompt = """你是一个AI Vlog创作项目的总负责人。

你的目标：帮用户基于爆款Vlog的结构，用他们的日常素材，生成一条新的Vlog。

你管理着6位专家：
  - analyst：视频分析师，能拆解爆款Vlog的结构、节奏、包装
  - material_manager：素材管家，能分析用户素材、识别缺口
  - planner：编导策划师，能制定Vlog迁移方案
  - creative：创作补全师，能用各种策略补全素材缺口
  - assembler：合成师，能把方案和素材合成视频
  - reviewer：审核师，能评估方案质量

你的工作方式：
1. 观察当前全局状态
2. 决定下一步应该让哪位专家做什么
3. 每次只派一个任务给一个专家
4. 专家完成后会更新状态，你再做下一步决策

你的决策要体现智慧：
- 不需要机械地按固定顺序走，根据实际情况灵活安排
- 如果某步结果不好，可以让专家重做或换个方向
- 如果缺口太多，可以先让planner调整方案减少缺口
- 如果审核指出核心问题（如hook不行），优先解决
- 知道什么时候该收手，不要无限迭代"""

    # 重写 run 方法，因为 Supervisor 的循环是"选子Agent"而不是"调工具"
    async def run(self, state: dict) -> dict:
        observation = self._build_observe_prompt(state, [])

        decision = await self._decide_next_agent(observation, state)

        # 记录决策日志
        logs = list(state.get("logs", []))
        logs.append({
            "agent": "supervisor",
            "decision": decision["next_agent"],
            "reasoning": decision["reasoning"],
            "task": decision.get("task_description", ""),
        })

        return {
            "current_task": {
                "target_agent": decision["next_agent"],
                "task_description": decision.get("task_description", ""),
                "context": decision.get("context", {}),
            },
            "logs": logs,
        }

    def _build_observe_prompt(self, state, _) -> str:
        parts = []

        # 用户输入状态
        if state.get("sample_videos"):
            parts.append(f"输入：{len(state['sample_videos'])} 条爆款视频")
        if state.get("user_materials"):
            parts.append(f"输入：{len(state['user_materials'])} 个用户素材")
        if state.get("target_topic"):
            parts.append(f"目标：制作「{state['target_topic']}」主题的Vlog")

        # 分析结果状态
        if state.get("source_structures"):
            s = state["source_structures"][0]
            parts.append(f"✅ 爆款分析完成：{len(s.shots)}个镜头，结构类型={s.vlog_meta.structure_type if s.vlog_meta else '未知'}")
        else:
            parts.append("❌ 爆款视频尚未分析")

        # 素材状态
        inv = state.get("material_inventory")
        if inv:
            gaps = inv.get_unfilled_gaps()
            parts.append(f"✅ 素材已入库：{len(inv.items)}个素材，{len(gaps)}个缺口，覆盖率{inv.coverage_rate:.0%}")
            if gaps:
                high_pri = [g for g in gaps if g.priority >= 3]
                parts.append(f"  ⚠️ 高优先级缺口：{len(high_pri)}个")
        else:
            parts.append("❌ 素材尚未入库")

        # 方案状态
        scheme = state.get("scheme")
        if scheme:
            parts.append(f"✅ 方案已生成：{len(scheme.storyboard)}个分镜，v{scheme.version}")
        else:
            parts.append("❌ 方案尚未生成")

        # 合成状态
        if state.get("rendered_video_path"):
            parts.append(f"✅ 视频已合成：{state['rendered_video_path']}")
        else:
            parts.append("❌ 视频尚未合成")

        # 审核状态
        review = state.get("review_result")
        if review:
            parts.append(f"审核结果：总分{review.get('total_score', 0)}，{'✅通过' if review.get('pass') else '❌未通过'}")
            if not review.get('pass') and review.get('top_3_issues'):
                parts.append(f"  主要问题：{review['top_3_issues'][0]}")

        parts.append(f"迭代轮次：{state.get('iteration', 0)}/{state.get('max_iterations', 3)}")

        return "\n".join(parts)

    async def _decide_next_agent(self, observation, state) -> dict:
        agents_desc = """
  - analyst：分析爆款Vlog的结构、节奏、包装（当爆款视频未分析时调用）
  - material_manager：分析用户素材并入库（当素材未入库时调用）；识别方案的素材缺口（当有方案但未检查缺口时调用）
  - planner：制定或修改Vlog迁移方案（当需要新方案或迭代方案时调用）
  - creative：补全素材缺口（当有未补全的缺口时调用）
  - assembler：合成视频（当方案和素材都就绪时调用）
  - reviewer：审核方案质量（当方案就绪时调用）
  - finish：任务完成，输出结果（当审核通过或达到最大迭代时）
"""
        prompt = f"""{self.system_prompt}

【当前全局状态】
{observation}

【可调度的专家】
{agents_desc}

请根据当前状态，决定下一步调度哪个专家、做什么任务。

注意：
1. 每次只调度一个专家
2. 你可以根据实际情况灵活决策，不必机械地按固定顺序
3. 如果你觉得当前结果已经足够好，可以选择 finish
4. 如果迭代次数已经很多，倾向于 finish 而不是继续改

用JSON回答：
{{
  "next_agent": "analyst/material_manager/planner/creative/assembler/reviewer/finish",
  "reasoning": "为什么做这个决策",
  "task_description": "给这位专家的具体任务描述（越具体越好）",
  "context": {{"需要传给专家的额外信息"}}
}}"""
        response = await self.llm.chat(prompt, response_format="json")
        return self.llm.parse_json(response)

    def route(self, state) -> str:
        """LangGraph 路由函数：根据 Supervisor 决策跳转"""
        task = state.get("current_task", {})
        target = task.get("target_agent", "finish")
        if target not in self.sub_agents and target != "finish":
            return "finish"
        return target
```

### 5.3 Analyst Agent

```python
# agents/analyst.py

class AnalystAgent(BaseAgent):
    """视频分析师：拆解爆款Vlog的结构"""

    def __init__(self, llm_tools, video_tools, face_tools, audio_tools):
        super().__init__(AgentRole.ANALYST, llm_tools)
        self.video = video_tools
        self.face = face_tools
        self.audio = audio_tools
        self.system_prompt = """你是一位有8年经验的短视频内容分析师，专门研究爆款Vlog的画面语言和结构模式。你能从一条Vlog中读出完整的结构密码——脚本节奏、镜头语言、包装手法、情绪曲线。

你的能力：
  - get_video_info：获取视频基础信息
  - detect_scenes：镜头切分
  - extract_frame：抽取关键帧
  - extract_audio：抽取音频
  - transcribe_audio：语音转写
  - detect_face：人脸检测
  - analyze_frame：用LLM分析单帧画面
  - analyze_structure：用LLM做全局结构分析

你接到任务后，自主决定分析步骤和深度。"""
        self.tools = {
            "get_video_info": self._get_video_info,
            "detect_scenes": self._detect_scenes,
            "extract_frame": self._extract_frame,
            "extract_audio": self._extract_audio,
            "transcribe_audio": self._transcribe_audio,
            "detect_face": self._detect_face,
            "analyze_frame": self._analyze_frame,
            "analyze_structure": self._analyze_structure,
            "done": self._done,
        }

    def _build_observe_prompt(self, state, history) -> str:
        task = state.get("current_task", {})
        return f"""任务：{task.get('task_description', '分析爆款Vlog')}
视频路径：{task.get('context', {}).get('video_path', state.get('sample_videos', [''])[0])}
已执行 {len(history)} 步"""

    def _process_step_result(self, step, result) -> dict:
        """中间步骤的结果缓存到内部，最终 done 时一次性写入 State"""
        return {}

    async def _analyze_frame(self, video_path, shot_index, start_time, end_time,
                              total_duration, prev_frame_desc="") -> dict:
        """用LLM分析单帧画面"""
        frame_path = self.video.extract_frame(video_path, (start_time + end_time) / 2)
        has_face = self.face.has_face(frame_path)
        prompt = build_shot_analysis_prompt(shot_index, start_time, end_time,
                                            total_duration, prev_frame_desc)
        response = await self.llm.chat(prompt, response_format="json")
        result = self.llm.parse_json(response)
        result["has_face"] = has_face
        return result

    async def _analyze_structure(self, video_path, shot_analyses, transcript) -> dict:
        """LLM 全局结构分析"""
        info = self.video.get_video_info(video_path)
        prompt = build_structure_analysis_prompt(
            info["duration"], info["width"], info["height"],
            len(shot_analyses), shot_analyses, transcript
        )
        response = await self.llm.chat(prompt, response_format="json")
        return self.llm.parse_json(response)

    async def _get_video_info(self, video_path) -> dict:
        """获取视频基础信息"""
        return self.video.get_video_info(video_path)

    async def _detect_scenes(self, video_path, threshold=0.3) -> list:
        """镜头切分"""
        return self.video.detect_scene_changes(video_path, threshold)

    async def _extract_frame(self, video_path, time_sec) -> str:
        """抽取关键帧"""
        return self.video.extract_frame(video_path, time_sec)

    async def _extract_audio(self, video_path) -> str:
        """抽取音频"""
        return self.video.extract_audio(video_path)

    async def _transcribe_audio(self, audio_path) -> str:
        """语音转写"""
        return self.audio.transcribe(audio_path)

    async def _detect_face(self, image_path) -> dict:
        """人脸检测"""
        return {"has_face": self.face.has_face(image_path),
                "region": self.face.get_main_face_region(image_path)}

    async def _done(self, result_summary, structure_data) -> dict:
        """任务完成，返回最终结果"""
        return {"status": "done", "summary": result_summary, "structure": structure_data}
```

### 5.4 Material Manager Agent

```python
# agents/material_manager.py

class MaterialManagerAgent(BaseAgent):
    """素材管家：素材入库分析 + 缺口识别"""

    def __init__(self, llm_tools, video_tools, face_tools):
        super().__init__(AgentRole.MATERIAL_MANAGER, llm_tools)
        self.video = video_tools
        self.face = face_tools
        self.system_prompt = """你是一位Vlog素材管家，有两个核心能力：

能力一：素材入库
  对用户上传的图片/视频/文本素材做内容理解、质量评估、标签分类。
  判断每个素材在Vlog中适合放在什么位置（hook/场景/日常/高潮/人物/结尾）。

能力二：缺口识别
  检查Vlog方案的分镜表，判断哪些镜头有合适素材、哪些是缺口。
  对每个缺口评估影响程度，建议补全策略。

你接到任务后，自主决定执行哪些步骤。"""
        self.tools = {
            "analyze_image": self._analyze_image,
            "analyze_video_material": self._analyze_video_material,
            "analyze_text": self._analyze_text,
            "detect_face": self._detect_face,
            "check_gaps": self._check_gaps,
            "done": self._done,
        }

    def _build_observe_prompt(self, state, history) -> str:
        task = state.get("current_task", {})
        desc = task.get("task_description", "")
        if state.get("material_inventory"):
            inv = state["material_inventory"]
            desc += f"\n当前素材库：{len(inv.items)}个素材，{len(inv.get_unfilled_gaps())}个缺口"
        return f"任务：{desc}\n已执行 {len(history)} 步"

    async def _analyze_image(self, material_id, image_path, target_topic, topic_desc) -> dict:
        prompt = build_image_analysis_prompt(material_id, target_topic, topic_desc)
        response = await self.llm.chat(prompt, response_format="json")
        result = self.llm.parse_json(response)
        result["has_face"] = self.face.has_face(image_path)
        if result["has_face"]:
            result["main_face_region"] = self.face.get_main_face_region(image_path)
        return result

    async def _analyze_video_material(self, material_id, video_path, target_topic) -> dict:
        info = self.video.get_video_info(video_path)
        frames = []
        for t in [i * 2 for i in range(int(info["duration"] / 2) + 1)]:
            fp = self.video.extract_frame(video_path, t)
            frames.append(f"{t}s: (frame at {fp})")
        prompt = build_video_analysis_prompt(material_id, target_topic,
                                              info["duration"], "\n".join(frames))
        response = await self.llm.chat(prompt, response_format="json")
        return self.llm.parse_json(response)

    async def _analyze_text(self, target_topic, text_content) -> dict:
        prompt = build_text_analysis_prompt(target_topic, text_content)
        response = await self.llm.chat(prompt, response_format="json")
        return self.llm.parse_json(response)

    async def _detect_face(self, image_path) -> dict:
        return {"has_face": self.face.has_face(image_path),
                "region": self.face.get_main_face_region(image_path)}

    async def _check_gaps(self, storyboard_desc, materials_desc) -> dict:
        prompt = build_gap_check_prompt(storyboard_desc, materials_desc)
        response = await self.llm.chat(prompt, response_format="json")
        return self.llm.parse_json(response)

    async def _done(self, inventory_summary) -> dict:
        return {"status": "done", "summary": inventory_summary}
```

### 5.5 Planner Agent

```python
# agents/planner.py

class PlannerAgent(BaseAgent):
    """编导策划师：制定Vlog迁移方案"""

    def __init__(self, llm_tools):
        super().__init__(AgentRole.PLANNER, llm_tools)
        self.system_prompt = """你是一位Vlog赛道金牌编导，专长是"结构迁移"——把爆款Vlog的成功结构方法论迁移到新内容上。

你的能力：
  - extract_skeleton：从爆款分析中提取可迁移的结构骨架
  - generate_scheme：基于骨架+新内容+素材生成完整方案
  - iterate_scheme：根据审核反馈修改方案
  - decide_narrative：根据素材特征选择叙事类型

你接到任务后，自主决定迁移策略。"""
        self.tools = {
            "extract_skeleton": self._extract_skeleton,
            "generate_scheme": self._generate_scheme,
            "iterate_scheme": self._iterate_scheme,
            "decide_narrative": self._decide_narrative,
            "done": self._done,
        }

    def _build_observe_prompt(self, state, history) -> str:
        task = state.get("current_task", {})
        parts = [f"任务：{task.get('task_description', '')}"]
        if state.get("source_structures"):
            s = state["source_structures"][0]
            parts.append(f"爆款结构：{s.structure_summary}")
        if state.get("material_inventory"):
            inv = state["material_inventory"]
            parts.append(f"素材：{len(inv.items)}个，{len(inv.get_face_items())}个有人脸")
        if state.get("review_result"):
            r = state["review_result"]
            parts.append(f"审核反馈：总分{r.get('total_score')}，问题={r.get('top_3_issues', [])}")
        parts.append(f"已执行 {len(history)} 步")
        return "\n".join(parts)

    async def _extract_skeleton(self, source_structure_json) -> dict:
        prompt = build_skeleton_extract_prompt(source_structure_json)
        response = await self.llm.chat(prompt, response_format="json")
        return self.llm.parse_json(response)

    async def _generate_scheme(self, skeleton, key_techniques, target_topic,
        target_info, target_duration, style, materials_desc, knowledge_refs,
        preferences) -> dict:
        prompt = build_scheme_generate_prompt(
            skeleton, key_techniques, target_topic, target_info,
            target_duration, style, materials_desc, knowledge_refs, preferences
        )
        response = await self.llm.chat(prompt, response_format="json")
        return self.llm.parse_json(response)

    async def _iterate_scheme(self, previous_scheme, review_scores,
        review_issues, review_suggestions, skeleton, materials_desc) -> dict:
        prompt = build_scheme_iterate_prompt(
            previous_scheme, review_scores, review_issues,
            review_suggestions, skeleton, materials_desc
        )
        response = await self.llm.chat(prompt, response_format="json")
        return self.llm.parse_json(response)

    async def _decide_narrative(self, materials_desc, topic) -> dict:
        prompt = f"""根据以下素材特征，决定这条Vlog最适合的叙事类型：

素材概况：{materials_desc}
主题：{topic}

选项：
- timeline（时间线）：素材有明确的时间顺序（如：早上→中午→傍晚）
- emotion（情绪线）：素材以情绪表达为主，没有明确时间关系
- event（事件线）：围绕一个事件展开（如：一次旅行、一场活动）

用JSON回答：{{"narrative_type": "timeline/emotion/event", "reasoning": ""}}"""
        response = await self.llm.chat(prompt, response_format="json")
        return self.llm.parse_json(response)

    async def _done(self, scheme_summary) -> dict:
        return {"status": "done", "summary": scheme_summary}
```

### 5.6 Creative Agent

```python
# agents/creative.py

class CreativeAgent(BaseAgent):
    """创作补全师：用各种策略补全素材缺口"""

    def __init__(self, llm_tools, video_tools, face_tools):
        super().__init__(AgentRole.CREATIVE, llm_tools)
        self.video = video_tools
        self.face = face_tools
        self.system_prompt = """你是一位Vlog创意补全专家。当Vlog方案存在素材缺口时，你用最低成本产出最好的补全方案。

你的工具箱：
  - crop_material：裁切素材的指定区域（一张图出多个镜头）
  - apply_ken_burns：对图片做动态效果（zoom_in/zoom_out/pan/focus_scan）
  - generate_text_card：生成文字卡视频片段
  - apply_speed_change：变速处理（慢放/快放）
  - apply_reverse：倒放
  - mirror_material：镜像翻转
  - reorder_storyboard：调整分镜顺序（结构重排）
  - generate_subtitle_overlay：为现有素材叠加创意字幕

Vlog补全的核心原则：
  - 文字卡在Vlog中完全被接受，是合法的镜头替代
  - Ken Burns让静态照片"活"起来，是Vlog标配
  - 空镜头（天空/街道/光影）在Vlog中是加分项
  - 有脸的素材优先保留给hook和高潮
  - 宁可少一个镜头也不要放一个突兀的补全"""
        self.tools = {
            "crop_material": self._crop_material,
            "apply_ken_burns": self._apply_ken_burns,
            "generate_text_card": self._generate_text_card,
            "apply_speed_change": self._apply_speed_change,
            "apply_reverse": self._apply_reverse,
            "mirror_material": self._mirror_material,
            "reorder_storyboard": self._reorder_storyboard,
            "generate_subtitle_overlay": self._generate_subtitle_overlay,
            "plan_fill_strategy": self._plan_fill_strategy,
            "done": self._done,
        }

    def _build_observe_prompt(self, state, history) -> str:
        task = state.get("current_task", {})
        inv = state.get("material_inventory")
        parts = [f"任务：{task.get('task_description', '')}"]
        if inv:
            gaps = inv.get_unfilled_gaps()
            parts.append(f"未补全缺口：{len(gaps)}个")
            for g in gaps[:5]:
                parts.append(f"  - 槽位{g.slot_index}：需要{g.required_type.value}，优先级{g.priority}")
        parts.append(f"已执行 {len(history)} 步")
        return "\n".join(parts)

    async def _plan_fill_strategy(self, gaps_desc, materials_desc, style_guide) -> dict:
        """LLM 规划补全策略"""
        prompt = build_fill_strategy_prompt(
            "", "", gaps_desc, materials_desc, style_guide
        )
        response = await self.llm.chat(prompt, response_format="json")
        return self.llm.parse_json(response)

    async def _crop_material(self, material_id, region) -> dict:
        """裁切素材"""
        path = self._get_material_path(material_id)
        new_path = self.video.crop_image(path, region)
        return {"new_path": new_path, "strategy": "素材裁切复用"}

    async def _apply_ken_burns(self, material_id, motion_type, speed, 
                                focus_on_face=False, duration=3.0) -> dict:
        """Ken Burns 效果"""
        path = self._get_material_path(material_id)
        focus_region = None
        if focus_on_face:
            focus_region = self.face.get_main_face_region(path)
        new_path = self.video.apply_ken_burns(path, motion_type, speed,
                                               focus_region, duration)
        return {"new_path": new_path, "strategy": "Ken Burns"}

    async def _generate_text_card(self, text, bg_color, font_style, 
                                   text_color, animation, duration) -> dict:
        """生成文字卡"""
        new_path = self.video.generate_text_card(
            text, bg_color, font_style, text_color, animation, duration
        )
        return {"new_path": new_path, "strategy": "文字卡替代"}

    async def _apply_speed_change(self, material_id, factor) -> dict:
        path = self._get_material_path(material_id)
        new_path = self.video.apply_speed_change(path, factor)
        return {"new_path": new_path, "strategy": f"变速{factor}x"}

    async def _apply_reverse(self, material_id) -> dict:
        path = self._get_material_path(material_id)
        new_path = self.video.apply_reverse(path)
        return {"new_path": new_path, "strategy": "倒放"}

    async def _mirror_material(self, material_id) -> dict:
        path = self._get_material_path(material_id)
        new_path = self.video.apply_speed_change(path, 1.0)  # TODO: 镜像
        return {"new_path": new_path, "strategy": "镜像翻转"}

    async def _reorder_storyboard(self, new_order) -> dict:
        return {"new_order": new_order, "strategy": "结构重排"}

    async def _generate_subtitle_overlay(self, material_id, subtitle_text) -> dict:
        path = self._get_material_path(material_id)
        new_path = self.video.overlay_subtitle(path, {"text": subtitle_text})
        return {"new_path": new_path, "strategy": "字幕叠加"}

    async def _done(self, summary) -> dict:
        return {"status": "done", "summary": summary}

    def _get_material_path(self, material_id):
        # 从内部缓存或 State 中查找
        ...
```

### 5.7 Assembler Agent

```python
# agents/assembler.py

class AssemblerAgent(BaseAgent):
    """合成师：将方案+素材合成视频（Phase 1 纯 FFmpeg）"""

    def __init__(self, llm_tools, video_tools):
        super().__init__(AgentRole.ASSEMBLER, llm_tools)
        self.video = video_tools
        self.system_prompt = """你是Vlog合成师。你的工作是把编导制定的方案和准备好的素材，合成一条完整的Vlog视频。

你不需要做创意决策，你的工作是精确执行方案：
  - prepare_frame：为单个分镜准备视频片段（图片→动效视频/视频→裁切/文字卡→生成）
  - apply_subtitle：叠加字幕
  - apply_color_grade：调色
  - concat_all：拼接所有片段+转场
  - finalize：编码输出最终视频

你的目标是合成一条画面连贯、字幕清晰、转场自然的Vlog。"""
        self.tools = {
            "prepare_frame": self._prepare_frame,
            "apply_subtitle": self._apply_subtitle,
            "apply_color_grade": self._apply_color_grade,
            "concat_all": self._concat_all,
            "finalize": self._finalize,
            "done": self._done,
        }

    def _build_observe_prompt(self, state, history) -> str:
        scheme = state.get("scheme")
        task = state.get("current_task", {})
        parts = [f"任务：{task.get('task_description', '合成视频')}"]
        if scheme:
            parts.append(f"方案：{len(scheme.storyboard)}个分镜，目标{scheme.target_duration}秒")
            prepared = sum(1 for f in scheme.storyboard 
                          if hasattr(f, '_prepared_path') and f._prepared_path)
            parts.append(f"已准备：{prepared}/{len(scheme.storyboard)} 个片段")
        parts.append(f"已执行 {len(history)} 步")
        return "\n".join(parts)

    async def _prepare_frame(self, frame_index, material_path, material_type,
                              duration, motion_effect="none") -> dict:
        """为单个分镜准备视频片段"""
        if material_type == "text_card":
            # 文字卡已经在 Creative 阶段生成
            return {"path": material_path, "ready": True}
        elif material_type == "image":
            if motion_effect and motion_effect != "none":
                path = self.video.apply_ken_burns(material_path, motion_effect, "slow",
                                                   duration=duration)
            else:
                path = material_path  # static loop handled in concat
            return {"path": path, "ready": True}
        elif material_type == "video":
            path = self.video.extract_highlight_clip(material_path, 0, duration)
            return {"path": path, "ready": True}
        return {"path": material_path, "ready": True}

    async def _apply_subtitle(self, clip_path, subtitle_config) -> dict:
        new_path = self.video.overlay_subtitle(clip_path, subtitle_config)
        return {"path": new_path}

    async def _apply_color_grade(self, clip_path, grade_config) -> dict:
        new_path = self.video.apply_basic_color_grade(clip_path, grade_config)
        return {"path": new_path}

    async def _concat_all(self, clip_paths, transitions) -> dict:
        path = self.video.concat_clips(clip_paths, transitions)
        return {"path": path}

    async def _finalize(self, input_path, output_path, resolution="1080x1920") -> dict:
        # FFmpeg 编码输出
        return {"output_path": output_path}

    async def _done(self, output_path) -> dict:
        return {"status": "done", "output_path": output_path}
```

### 5.8 Reviewer Agent

```python
# agents/reviewer.py

class ReviewerAgent(BaseAgent):
    """审核评估师：评估Vlog迁移方案质量"""

    def __init__(self, llm_tools):
        super().__init__(AgentRole.REVIEWER, llm_tools)
        self.system_prompt = """你是一位严苛但公正的Vlog审核专家。

审核标准基于真实数据经验：
  - Vlog生死在前3秒，hook不行后面全白搭
  - 需要"呼吸感"——不能全程快切也不能全程慢
  - 情绪一致性比内容丰富度更重要
  - 最怕"假"和"刻意"
  - 文字卡在Vlog中完全合法

你的能力：
  - review_scheme：对方案做8维度评估打分
  - suggest_fix：针对具体问题给出修改建议
  - done：输出审核结论"""
        self.tools = {
            "review_scheme": self._review_scheme,
            "suggest_fix": self._suggest_fix,
            "done": self._done,
        }

    def _build_observe_prompt(self, state, history) -> str:
        scheme = state.get("scheme")
        task = state.get("current_task", {})
        parts = [f"任务：{task.get('task_description', '审核方案')}"]
        if scheme:
            parts.append(f"方案v{scheme.version}：{len(scheme.storyboard)}个分镜，{scheme.target_duration}秒")
            parts.append(f"叙事类型：{scheme.narrative_type}，结构类型：{scheme.structure_type}")
        if state.get("source_structures"):
            parts.append(f"原始爆款：{state['source_structures'][0].structure_summary}")
        inv = state.get("material_inventory")
        if inv:
            parts.append(f"素材覆盖率：{inv.coverage_rate:.0%}")
        parts.append(f"已执行 {len(history)} 步")
        return "\n".join(parts)

    async def _review_scheme(self, source_summary, scheme_json, coverage_desc) -> dict:
        prompt = build_review_prompt(source_summary, scheme_json, coverage_desc)
        response = await self.llm.chat(prompt, response_format="json")
        return self.llm.parse_json(response)

    async def _suggest_fix(self, issue, scheme_context) -> dict:
        prompt = f"""针对以下Vlog方案问题，给出具体的修改建议：

问题：{issue}
方案上下文：{scheme_context}

要求：建议要具体、可执行，不要泛泛而谈。
用JSON回答：{{"suggestions": [{{"what": "改什么", "how": "怎么改", "why": "为什么"}}]}}"""
        response = await self.llm.chat(prompt, response_format="json")
        return self.llm.parse_json(response)

    async def _done(self, review_summary) -> dict:
        return {"status": "done", "summary": review_summary}
```

---

## 六、LangGraph 图构建

```python
# graph/builder.py

from langgraph.graph import StateGraph, END
from graph.state import ViralEngineState


def build_agent_graph(agents: dict):
    """
    构建 Agent 图。
    核心：Supervisor 是唯一的路由中心，子 Agent 执行完后都回到 Supervisor。

    agents: {
        "supervisor": SupervisorAgent,
        "analyst": AnalystAgent,
        "material_manager": MaterialManagerAgent,
        "planner": PlannerAgent,
        "creative": CreativeAgent,
        "assembler": AssemblerAgent,
        "reviewer": ReviewerAgent,
    }
    """
    graph = StateGraph(ViralEngineState)

    # 注册所有 Agent 为节点
    graph.add_node("supervisor", agents["supervisor"].run)
    graph.add_node("analyst", agents["analyst"].run)
    graph.add_node("material_manager", agents["material_manager"].run)
    graph.add_node("planner", agents["planner"].run)
    graph.add_node("creative", agents["creative"].run)
    graph.add_node("assembler", agents["assembler"].run)
    graph.add_node("reviewer", agents["reviewer"].run)

    # 入口是 Supervisor
    graph.set_entry_point("supervisor")

    # Supervisor 根据 LLM 决策路由到子 Agent 或 END
    graph.add_conditional_edges(
        "supervisor",
        agents["supervisor"].route,
        {
            "analyst": "analyst",
            "material_manager": "material_manager",
            "planner": "planner",
            "creative": "creative",
            "assembler": "assembler",
            "reviewer": "reviewer",
            "finish": END,
        },
    )

    # 所有子 Agent 执行完后回到 Supervisor
    for agent_name in ["analyst", "material_manager", "planner",
                        "creative", "assembler", "reviewer"]:
        graph.add_edge(agent_name, "supervisor")

    return graph.compile()
```

图拓扑：

```
              ┌──────────────┐
              │  supervisor  │◄──────────────────────────────┐
              │  (LLM决策)    │                               │
              └──────┬───────┘                               │
                     │ LLM 自主决策                           │
        ┌────────┬───┴───┬────────┬──────────┬─────────┐    │
        ▼        ▼       ▼        ▼          ▼         ▼    │
   ┌────────┐┌───────┐┌───────┐┌────────┐┌────────┐┌────────┐
   │analyst ││materal││planner││creative││assembl ││reviewer│
   │(ReAct) ││(ReAct)││(ReAct)││(ReAct) ││(ReAct) ││(ReAct) │
   └───┬────┘└───┬───┘└───┬───┘└───┬────┘└───┬────┘└───┬────┘
       │         │        │        │         │         │
       └─────────┴────────┴────────┴─────────┴─────────┘
                              │
                              └──── 全部回到 supervisor ──────┘

关键特性：
  1. 没有固定流程——Supervisor 根据情况动态决定下一步
  2. 子 Agent 之间没有直接连线——必须经过 Supervisor
  3. Supervisor 可以让任何 Agent 重复执行（如让 Creative 多次补全）
  4. Supervisor 可以跳过某些 Agent（如素材充足时跳过 Creative）
  5. finish 由 Supervisor 的 LLM 决策触发，不是硬编码条件
```

---

## 七、Prompts

所有 Prompt 模板与 v1 相同，完整保留在 `prompts/` 目录下。

### 7.1 Prompt 清单

```
prompts/
├── supervisor_prompts.py       # Supervisor 决策 Prompt（内嵌在 SupervisorAgent 中）
├── analyst_prompts.py          # 2 个：逐帧分析 + 综合结构分析
├── material_prompts.py         # 4 个：图片/视频/文本分析 + 缺口检查
├── planner_prompts.py          # 3 个：骨架提取 + 方案生成 + 迭代优化
├── creative_prompts.py         # 2 个：补全策略 + 文案卡生成
├── reviewer_prompts.py         # 1 个：方案质量评估
└── knowledge_prompts.py        # 2 个（Phase 4）
```

### 7.2 各 Prompt 函数签名

```python
# analyst_prompts.py
def build_shot_analysis_prompt(shot_index, start_time, end_time, 
                                total_duration, prev_frame_desc) -> str
def build_structure_analysis_prompt(duration, width, height, shot_count,
                                     shot_analyses_text, transcript) -> str

# material_prompts.py
def build_image_analysis_prompt(material_id, target_topic, topic_description) -> str
def build_video_analysis_prompt(material_id, target_topic, duration, 
                                 frame_descriptions) -> str
def build_text_analysis_prompt(target_topic, text_content) -> str
def build_gap_check_prompt(storyboard_json, materials_summary) -> str

# planner_prompts.py
def build_skeleton_extract_prompt(source_structure_json) -> str
def build_scheme_generate_prompt(skeleton_analysis, key_techniques, target_topic,
    target_info, target_duration, style_preference, material_inventory_desc,
    knowledge_refs, user_preferences) -> str
def build_scheme_iterate_prompt(previous_scheme_json, review_scores, review_issues,
    review_suggestions, skeleton_analysis, material_inventory_desc) -> str

# creative_prompts.py
def build_fill_strategy_prompt(target_topic, scheme_summary, gaps_list,
    available_materials, style_guide) -> str
def build_text_card_content_prompt(target_topic, card_purpose, emotion, 
                                    style_guide) -> str

# reviewer_prompts.py
def build_review_prompt(source_structure_summary, scheme_json, 
                         material_coverage_desc) -> str
```

> 各 Prompt 的完整内容与 v1 相同，此处不重复。参见 v1 文档中对应章节。

---

## 八、Supervisor 决策场景示例

展示 Supervisor 在不同阶段如何自主决策，体现 Agent 系统的灵活性：

### 场景 1：正常流程

```
Supervisor 观察：用户输入了1条爆款Vlog和5张照片，目标30秒新Vlog。
  → 没有分析结果 → 决策：调用 analyst 分析爆款

Supervisor 观察：爆款分析完成，有15个镜头、6个段落。
  → 素材未入库 → 决策：调用 material_manager 入库素材

Supervisor 观察：5个素材入库，2个有人脸。还没有方案。
  → 决策：调用 planner 生成方案

Supervisor 观察：方案12个分镜。缺口未检查。
  → 决策：调用 material_manager 检查缺口

Supervisor 观察：3个缺口（hook/高潮/收尾），覆盖率75%。
  → 有缺口 → 决策：调用 creative 补全

Supervisor 观察：3个缺口都已补全（Ken Burns+文字卡+素材复用）。
  → 方案+素材就绪 → 决策：调用 assembler 合成

Supervisor 观察：视频已合成。
  → 决策：调用 reviewer 审核

Supervisor 观察：审核总分68，通过。
  → 决策：finish
```

### 场景 2：灵活应对

```
Supervisor 观察：方案12个分镜，但有7个缺口，覆盖率42%。
  → 缺口太多，补全后效果会很差
  → 决策：调用 planner，任务="请调整方案，当前素材只有5张照片，
    请减少对素材数量的依赖，多用文字卡和Ken Burns，把方案控制在
    8个分镜以内"

Supervisor 观察：审核总分45，hook只得了3分。
  → hook是Vlog生死线，必须优先解决
  → 决策：调用 creative，任务="重点优化hook，用最有视觉冲击力的
    素材做开头，配合悬念字幕。当前hook太弱了。"

Supervisor 观察：已迭代3次，总分从45提升到58，还差2分没通过。
  → 已经迭代3次了，继续迭代提升空间不大
  → 决策：调用 assembler 重新合成当前方案，然后 finish
```

### 场景 3：Supervisor 的"越级"决策

```
Supervisor 观察：planner 生成了方案，但方案里用了"对比反转"结构，
  而用户素材全是温馨日常照，根本没有对比素材。
  → 结构和素材严重不匹配
  → 不走正常流程（check_gaps → fill_gaps），直接调用 planner
  → 任务="请换一种结构类型，当前素材不适合对比反转型，
    建议用日常流水型或情绪递进型"
```

---

## 九、Phase 1 实施计划

### 9.1 Phase 1 目标

跑通 Agent 架构下的完整 Vlog 创作闭环。

### 9.2 Phase 1 范围

```
✅ 实现：
  - Supervisor Agent（LLM 决策路由）
  - Analyst Agent（ReAct 循环：分析爆款）
  - Material Manager Agent（ReAct：入库+缺口识别）
  - Planner Agent（ReAct：方案生成+迭代）
  - Creative Agent（ReAct：素材复用+Ken Burns+文字卡+结构重排）
  - Assembler Agent（ReAct：FFmpeg 合成）
  - Reviewer Agent（ReAct：8维度审核）
  - 所有 Prompt 模板
  - tools/ 全部工具
  - LangGraph 图构建
  - main.py 端到端入口

⬜ 不实现：
  - Knowledge Agent + 知识库（Phase 4）
  - T2I / T2V / TTS（Phase 2）
  - Remotion 渲染（Phase 3）
  - 前端可视化（Phase 2）
```

### 9.3 周计划

```
Week 1: 基础设施
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Day 1-2: 项目骨架 + models/ + config/
Day 3:   tools/video_tools + face_tools + audio_tools
Day 4:   tools/llm_tools（Doubao API 对接验证）
Day 5:   prompts/ 全部 Prompt 函数 + 验证输出格式

Week 2: Agent 基础框架
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Day 1:   agents/base.py（ReAct 循环基类）
Day 2:   agents/supervisor.py（Supervisor Agent）
Day 3:   agents/analyst.py（Analyst Agent + ReAct 循环）
Day 4-5: 联调：Supervisor → Analyst → Supervisor 循环验证

Week 3: 核心 Agent 实现
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Day 1:   agents/material_manager.py
Day 2-3: agents/planner.py
Day 4-5: agents/creative.py

Week 4: 合成+审核+闭环
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Day 1:   agents/assembler.py
Day 2:   agents/reviewer.py
Day 3:   graph/builder.py + main.py 端到端联调
Day 4:   调试 Supervisor 决策质量
Day 5:   Demo 准备 + 文档
```

### 9.4 验收对照

| 课题任务 | Phase 1 覆盖 | 预期得分 |
|---------|-------------|---------|
| 任务1：样例输入与解析 | ✅ Analyst Agent 分析 | 4-5分 |
| 任务2：结构拆解 | ✅ 脚本+节奏+包装+叙事+情绪+人物 | 8-10分 |
| 任务3：新内容与素材输入 | ✅ Material Manager 入库 | 3分 |
| 任务4：结构迁移生成 | ✅ Planner Agent 方案 | 8-10分 |
| 任务5：素材缺口识别 | ✅ Material Manager 缺口 | 6-8分 |
| 任务6：素材缺口补全 | ✅ Creative Agent 4种策略 | 9-12分 |
| 任务7：迁移可视化 | ⬜ Phase 2 | 0分 |
| 任务8：结果可验证 | ✅ 视频demo+设计说明 | 6分 |
| **加分：Agent 自主决策** | ✅ Supervisor 动态路由+子Agent ReAct | +3-5分 |

**Phase 1 预估总分**：47-61分（含 Agent 加分）

### 9.5 后续规划

```
Phase 2 (Week 5-7):
  - Creative Agent 接入 T2I/T2V/TTS 工具
  - 迁移过程可视化页面
  - 包装生成增强
  - 多版本生成

Phase 3 (Week 8-9):
  - Assembler 切换 Remotion
  - 人工可调能力（用户修改 → Supervisor 重新调度）
  - 自然语言编辑

Phase 4 (Week 10-12):
  - Knowledge Agent + 知识库
  - 品类扩展
  - 答辩打磨
```

---

以上是基于 Agent 架构的完整技术规格。核心变化是从"State 传送带 + 固定节点 + 规则路由"改为"Supervisor 动态决策 + 子 Agent ReAct 循环 + 工具池共享"。