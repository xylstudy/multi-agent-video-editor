# 爆款结构迁移引擎 — 完整系统设计文档（Vlog 主题 · Phase 1 细化版）

---

## 第一章 系统总览

### 1.1 系统定位

一句话定义：**从爆款 Vlog 中学会"怎么拍怎么剪"，用用户手头的日常素材做出一条结构完整的新 Vlog。**

系统不是模板套用，不是 AI 一键生成，而是一套具备 **分析 → 记忆 → 规划 → 补全 → 合成 → 审核 → 迭代** 能力的 AI 创作引擎。它像一个成熟编导一样工作：看了大量爆款后形成自己的结构直觉，拿到新素材后快速出方案，素材不够时自己想办法补上。

### 1.2 技术栈

| 层面 | 选型 | 理由 |
|------|------|------|
| Agent 编排 | **LangGraph** (Python) | 原生支持状态图、条件路由、循环迭代、Checkpoint |
| LLM | **Doubao-Seed-2.0-lite** (火山方舟) | 已提供 API，延迟低，支持 JSON mode |
| 视频处理 | **FFmpeg + OpenCV** | 镜头切分、关键帧抽取、合成、Ken Burns 效果 |
| 人脸检测 | **face_recognition / OpenCV Haar** | Vlog 素材分级的核心依赖 |
| 语音转写 | **Whisper** (本地模型) | 不依赖云端，延迟可控 |
| 视频渲染 | Phase 1 用 **FFmpeg**，Phase 3 切 **Remotion** | 先跑通闭环，后续升级渲染能力 |
| 知识库 | **Chroma / FAISS** + LLM 提炼 | Phase 4 接入，Phase 1 预留接口 |
| 前端 | Phase 1 不涉及，后续 **React + TypeScript** | — |

### 1.3 LangGraph 核心概念与系统映射

```
LangGraph 概念          →  在本系统中的含义
─────────────────────────────────────────────
State (TypedDict)       →  ViralEngineState：全系统共享的"工作记忆"
Node (Python 函数)      →  一个业务处理阶段（内含 Agent 调用 + 工具调用）
Edge (有向边)           →  阶段之间的数据流方向
Conditional Edge        →  根据当前状态做路由决策（有缺口？通过审核？）
Checkpoint              →  流程中间状态的持久化（断点续跑）
Graph                   →  整个创作流程的完整拓扑
```

---

## 第二章 项目结构

```
viral-structure-engine/
│
├── graph/                              # LangGraph 图定义（顶层编排）
│   ├── __init__.py
│   ├── state.py                        # ViralEngineState 全局状态
│   ├── builder.py                      # 图的构建：节点注册 + 边连接 + 条件路由
│   └── nodes/                          # 每个节点 = 一个处理阶段
│       ├── __init__.py
│       ├── analyze_video.py            # 节点：分析爆款视频
│       ├── ingest_materials.py         # 节点：素材入库与理解
│       ├── plan_scheme.py              # 节点：生成迁移方案
│       ├── check_gaps.py               # 节点：识别素材缺口
│       ├── fill_gaps.py                # 节点：补全缺口
│       ├── assemble_video.py           # 节点：合成视频
│       ├── review_result.py            # 节点：审核结果
│       ├── store_knowledge.py          # 节点：知识沉淀（Phase 4）
│       └── routes.py                   # 所有条件路由函数
│
├── agents/                             # Agent 定义（LLM 推理封装）
│   ├── __init__.py
│   ├── base.py                         # BaseAgent 基类
│   ├── analyst.py                      # AnalystAgent — 视频分析
│   ├── planner.py                      # PlannerAgent — 编导方案
│   ├── material_manager.py             # MaterialManager — 素材管理
│   ├── creative.py                     # CreativeAgent — 创作补全
│   ├── reviewer.py                     # ReviewerAgent — 审核评估
│   └── knowledge_agent.py              # KnowledgeAgent — 知识提炼（Phase 4）
│
├── models/                             # 数据模型（全系统共享的数据语言）
│   ├── __init__.py
│   ├── video_structure.py              # VideoStructure + ShotType + VlogMeta + ...
│   ├── material.py                     # MaterialItem + MaterialGap + MaterialInventory
│   ├── scheme.py                       # VideoScheme + StoryboardFrame
│   └── knowledge.py                    # KnowledgeEntry + KnowledgeType
│
├── services/                           # 工具/服务层（可替换的底层能力）
│   ├── __init__.py
│   ├── llm_service.py                  # Doubao API 封装
│   ├── video_processor.py              # FFmpeg + OpenCV 封装
│   ├── face_detector.py                # 人脸检测
│   ├── asr_service.py                  # Whisper 语音转写
│   ├── tts_service.py                  # TTS 配音（Phase 2）
│   ├── image_gen_service.py            # T2I 图片生成（Phase 2）
│   ├── video_gen_service.py            # T2V 视频生成（Phase 2）
│   └── renderer_service.py             # Remotion 渲染（Phase 3）
│
├── prompts/                            # Prompt 模板（与 Agent 解耦，方便调优）
│   ├── __init__.py
│   ├── analyst_prompts.py              # Analyst 的 2 个 Prompt
│   ├── material_prompts.py             # Material Manager 的 4 个 Prompt
│   ├── planner_prompts.py              # Planner 的 3 个 Prompt
│   ├── creative_prompts.py             # Creative 的 4 个 Prompt
│   ├── reviewer_prompts.py             # Reviewer 的 2 个 Prompt
│   └── knowledge_prompts.py            # Knowledge 的 2 个 Prompt（Phase 4）
│
├── knowledge/                          # 知识库模块（Phase 4）
│   ├── __init__.py
│   ├── store.py                        # 知识存储与检索
│   ├── extractor.py                    # 知识提炼
│   └── index.py                        # 向量索引
│
├── config/                             # 配置
│   ├── __init__.py
│   └── settings.py                     # 全局配置（API Key、路径、参数）
│
├── data/                               # 数据目录
│   ├── samples/                        # 示例爆款 Vlog 视频
│   ├── assets/                         # 用户上传素材
│   ├── output/                         # 生成产物（视频、中间文件）
│   ├── temp/                           # 临时文件（关键帧、音频）
│   └── knowledge_db/                   # 知识库存储（Phase 4）
│
├── renderer/                           # Remotion 渲染层（Phase 3，TypeScript）
│   └── ...
│
├── tests/                              # 测试
│   ├── test_models.py
│   ├── test_agents.py
│   ├── test_nodes.py
│   └── test_pipeline.py
│
├── main.py                             # 入口（CLI / API）
├── pyproject.toml
└── README.md
```

**设计原则**：
- **prompts/ 独立于 agents/**：Prompt 是可以独立调优的资产，不应该写死在 Agent 代码里。Agent 引用 Prompt 模板，填入变量后调用 LLM。
- **models/ 是全系统的"语言"**：所有模块都依赖 models/，但 models/ 不依赖任何其他模块。
- **services/ 是可替换的**：今天用 Doubao，明天可以换 GPT-4o，只需要改 LLMService 的实现，上层无感知。

---

## 第三章 数据模型

### 3.1 模型总览与依赖关系

```
models/video_structure.py  ─────────────────────────────────┐
  ├── VideoStructure        ← 分析阶段的核心产出              │
  ├── VlogMeta              ← Vlog 专属元数据                 │
  ├── ShotInfo              ← 单镜头信息                      │
  ├── ScriptBlock           ← 脚本段落                        │
  ├── RhythmPoint           ← 节奏曲线点                      │
  ├── PackagingStyle        ← 包装风格                        │
  ├── SubtitleStyle         ← 字幕样式                        │
  ├── BGMInfo               ← BGM 信息                       │
  ├── ShotType (Enum)       ← 镜头类型（Vlog 扩展版）          │
  └── TransitionType (Enum) ← 转场类型                        │
                                                          ────┤
models/material.py          ─────────────────────────────────┤
  ├── MaterialItem          ← 单个素材                        │
  ├── MaterialGap           ← 素材缺口                        │
  ├── MaterialInventory     ← 素材清单（含缺口）               │
  ├── MaterialType (Enum)   ← 素材类型                        │
  └── MaterialQuality(Enum) ← 质量等级                        │
                                                          ────┤
models/scheme.py            ─────────────────────────────────┤
  ├── VideoScheme           ← 最终视频方案                     │
  └── StoryboardFrame       ← 分镜帧                          │
                                                          ────┤
models/knowledge.py         ─────────────────────────────────┘
  ├── KnowledgeEntry        ← 知识条目（Phase 4）
  └── KnowledgeType (Enum)  ← 知识类型（Vlog 扩展版）
```

### 3.2 video_structure.py — 完整定义

```python
"""
视频结构抽象：系统对一条视频"长什么样"的完整描述
这是全系统最核心的数据模型——分析阶段的产出，规划阶段的输入，审核阶段的参照
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ============================================================
# 枚举定义
# ============================================================

class ShotType(str, Enum):
    """镜头类型 — Vlog 扩展版"""
    
    # 通用类型（所有品类都用）
    HOOK = "hook"                           # 开头吸引
    CTA = "cta"                             # 号召行动/引导互动
    TRANSITION = "transition"               # 过渡连接
    
    # Vlog 专用类型
    SCENE_ESTABLISH = "scene_establish"     # 场景建立（展示地点/环境/空间感）
    DAILY_MOMENT = "daily_moment"           # 日常片段（做事/体验/过程）
    EMOTION_PEAK = "emotion_peak"           # 情绪高点（最美/最震撼/最感动的画面）
    PERSONA_EXPRESSION = "persona"          # 人物表达（口播/表情/反应/互动）
    INFO_CARD = "info_card"                 # 信息卡（字幕卡/文字信息/标题卡）
    CLOSING_MOMENT = "closing"              # 收尾定格（结尾画面/定格/渐隐）
    
    # 预留类型（后续品类扩展）
    PAIN_POINT = "pain_point"               # 痛点（电商/种草用）
    PRODUCT_SHOW = "product"                # 商品展示（电商用）
    USAGE_DEMO = "usage"                    # 使用演示（电商/种草用）
    COMPARISON = "comparison"               # 对比（电商用）


class TransitionType(str, Enum):
    """转场类型"""
    CUT = "cut"                 # 硬切（Vlog 最常用）
    FADE = "fade"               # 淡入淡出
    DISSOLVE = "dissolve"       # 叠化
    ZOOM_IN = "zoom_in"         # 缩放入场
    ZOOM_OUT = "zoom_out"       # 缩放出场
    FLASH_WHITE = "flash_white" # 闪白
    SLIDE = "slide"             # 滑动
    WHIP = "whip"               # 甩镜
    MASK = "mask"               # 遮罩转场
    NONE = "none"


# ============================================================
# 子结构定义
# ============================================================

@dataclass
class ShotInfo:
    """单个镜头的完整信息"""
    index: int                              # 镜头序号（从0开始）
    start_time: float                       # 开始时间（秒）
    end_time: float                         # 结束时间（秒）
    duration: float                         # 时长（秒）
    shot_type: ShotType                     # 镜头类型
    
    # 画面层
    visual_description: str = ""            # 画面内容描述
    camera_movement: str = ""               # 运镜方式（固定/推/拉/摇/移/跟）
    shot_size: str = ""                     # 景别（特写/近景/中景/全景/远景）
    composition: str = ""                   # 构图方式
    color_mood: str = ""                    # 色调氛围（暖调/冷调/高饱和）
    
    # 音频层
    subtitle_text: str = ""                 # 该镜头的字幕文本
    voiceover_text: str = ""                # 该镜头的旁白文本
    
    # 结构层
    transition_in: TransitionType = TransitionType.CUT  # 入场转场
    emotion: str = ""                       # 情绪标签（一个词）
    structure_purpose: str = ""             # 结构功能说明
    
    # Vlog 扩展
    has_face: bool = False                  # 是否有人脸出现
    bgm_sync: bool = False                  # 是否卡 BGM 节拍
    is_empty_shot: bool = False             # 是否为空镜头（纯环境/无主体）


@dataclass
class RhythmPoint:
    """节奏曲线上的一个时间点"""
    time: float                             # 时间点（秒）
    intensity: float                        # 节奏强度 0-1（0=静止/慢，1=快切/激烈）
    avg_shot_duration: float = 0            # 此时间点附近的平均镜头时长
    note: str = ""                          # 设计意图说明


@dataclass
class SubtitleStyle:
    """字幕样式"""
    font_family: str = ""                   # 字体（黑体/宋体/手写体/艺术字）
    font_size: int = 0                      # 字号
    color: str = ""                         # 字色
    stroke_color: str = ""                  # 描边色（Vlog 常用白色描边）
    stroke_width: int = 0                   # 描边宽度
    shadow: bool = False                    # 是否有阴影
    bg_color: Optional[str] = None          # 背景色（字幕背景条）
    background_style: str = "none"          # none / semi_bar / rounded_rect / full_card
    position: str = "bottom"                # 位置：top / bottom / center
    animation: str = "none"                 # 动画：none / typewriter / fade_in / bounce / slide_in
    typing_speed: float = 0                 # 打字机效果速度（字/秒）
    max_chars_per_line: int = 15            # 每行最大字数
    line_spacing: float = 1.2               # 行间距倍数


@dataclass
class PackagingStyle:
    """包装风格（整条视频的视觉包装方案）"""
    subtitle_style: SubtitleStyle = field(default_factory=SubtitleStyle)
    
    # 标题/文字卡
    title_card_style: str = ""              # 标题卡样式描述
    text_card_background: str = ""          # 文字卡背景样式（纯色/渐变/模糊底图）
    text_card_font: str = ""                # 文字卡字体
    
    # 转场偏好
    preferred_transitions: list[str] = field(default_factory=list)   # 偏好的转场类型
    transition_frequency: str = "moderate"   # 转场频率：sparse / moderate / frequent
    
    # 调色/滤镜
    color_grade: str = ""                   # 调色风格：japanese_fresh / film_retro / cinematic / vivid / b_w
    filter_style: str = ""                  # 滤镜风格描述
    visual_mood: str = ""                   # 整体视觉情绪：warm / cool / dreamy / energetic / calm
    
    # 强调元素
    emphasis_elements: list[str] = field(default_factory=list)       # 放大/圈注/箭头/闪光
    sticker_types: list[str] = field(default_factory=list)           # 贴纸类型
    
    # 色彩
    color_palette: list[str] = field(default_factory=list)           # 主色调列表（hex）
    
    # Ken Burns 默认配置
    default_ken_burns: str = "slow_zoom_in"  # 静态图默认动效：slow_zoom_in / slow_pan / focus_scan


@dataclass
class BGMInfo:
    """BGM 信息"""
    style: str = ""                         # 风格描述（轻快/舒缓/电子/吉他/钢琴）
    bpm: int = 0                            # 推测 BPM
    mood: str = ""                          # 情绪基调
    beat_points: list[float] = field(default_factory=list)   # 推测的卡点时间
    role: str = "background"                # BGM 角色：background / rhythm_driver / mood_setter
    reference_track: str = ""               # 参考曲目（如果能推测的话）


@dataclass
class VlogMeta:
    """Vlog 专属元数据"""
    
    # 叙事结构
    narrative_type: str = ""                # 叙事主线：timeline(时间线) / emotion(情绪线) / event(事件线)
    
    # 结构分类
    structure_type: str = ""                # 结构类型：
                                            #   suspense_first（悬念前置型）
                                            #   emotion_build（情绪递进型）
                                            #   rhythm_beat（节奏卡点型）
                                            #   daily_flow（日常流水型）
                                            #   contrast_flip（对比反转型）
                                            #   story_arc（故事叙事型）
    
    # 人物信息
    persona_type: str = ""                  # 出镜方式：
                                            #   voiceover（纯旁白不出镜）
                                            #   talking_head（口播/对镜说话）
                                            #   back_figure（背影/侧面）
                                            #   hands_only（手部特写）
                                            #   mixed（混合）
    persona_ratio: float = 0                # 人物出镜占比 0-1
    
    # Hook 策略
    hook_method: str = ""                   # hook 方式：
                                            #   suspense_question（悬念提问）
                                            #   visual_impact（视觉冲击）
                                            #   golden_quote（金句开头）
                                            #   contrast（反差对比）
                                            #   sound_hook（声音吸引）
    hook_detail: str = ""                   # hook 具体手法描述
    
    # 空镜
    empty_shot_count: int = 0               # 空镜头数量
    empty_shot_ratio: float = 0             # 空镜头占比
    
    # 情绪
    emotion_arc: list[dict] = field(default_factory=list)  # 情绪曲线 [{time, emotion, intensity}]
    overall_emotion: str = ""               # 整体情绪基调
    
    # 关键技法
    key_techniques: list[str] = field(default_factory=list)  # 关键技法标签
```

### 3.3 material.py — 完整定义

```python
"""
素材模型：用户上传的素材、AI 生成的素材、素材缺口
"""

from dataclasses import dataclass, field
from enum import Enum
from models.video_structure import ShotType


class MaterialType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    TEXT = "text"


class MaterialQuality(str, Enum):
    HIGH = "high"           # 高质量：高清、构图好、光影佳
    MEDIUM = "medium"       # 中等：可用但不完美
    LOW = "low"             # 低质量：建议替换
    UNUSABLE = "unusable"   # 不可用：模糊/过曝/不相关


@dataclass
class MaterialItem:
    """单个素材的完整信息"""
    id: str
    type: MaterialType
    path: str
    
    # 内容理解
    description: str = ""                   # LLM 生成的内容描述
    main_subject: str = ""                  # 主体（人物/美食/风景/建筑/物品）
    tags: list[str] = field(default_factory=list)
    
    # 媒体属性
    duration: float = 0                     # 视频/音频时长
    width: int = 0                          # 宽度
    height: int = 0                         # 高度
    
    # 质量评估
    quality: MaterialQuality = MaterialQuality.MEDIUM
    quality_notes: str = ""                 # 质量备注
    
    # Vlog 适用性
    suitable_for: list[ShotType] = field(default_factory=list)  # 适合的镜头位置
    emotion_label: str = ""                 # 情绪标签（happy/calm/excited/melancholy/surprised）
    scene_type: str = ""                    # 场景类型（indoor/outdoor/urban/nature/home/restaurant）
    light_quality: str = ""                 # 光影质量（golden_hour/soft/harsh/low_light/backlit）
    
    # 人脸信息
    has_face: bool = False
    face_count: int = 0
    main_face_region: tuple = ()            # 主脸区域 (x, y, w, h)
    
    # 动态化建议
    suggested_motion: str = ""              # 建议的动态效果：ken_burns_zoom_in/pan_left/static/focus_scan
    
    # 视频素材专有
    highlight_clips: list[dict] = field(default_factory=list)  # 高光片段 [{start, end, description}]
    has_usable_audio: bool = False          # 是否有可用音频
    
    # 来源标记
    is_ai_generated: bool = False           # 是否为 AI 生成
    generation_prompt: str = ""             # 生成用的 prompt（如果是 AI 生成的）
    source_gap_index: int = -1              # 来自哪个缺口（如果是补全生成的）
    
    # 元数据
    metadata: dict = field(default_factory=dict)


@dataclass
class MaterialGap:
    """素材缺口：目标结构中某个槽位缺少素材"""
    
    # 位置信息
    slot_index: int                         # 在分镜表中的位置
    required_type: ShotType                 # 需要的镜头类型
    purpose: str                            # 这个位置的目的描述
    needed_content: str                     # 需要什么内容的素材
    
    # 评估
    priority: int = 3                       # 优先级 1-5（5=必须补，1=可忽略）
    impact_if_not_filled: str = ""          # 不补的影响描述
    
    # 补全策略
    suggested_strategy: str = ""            # 建议的补全策略
    strategy_detail: str = ""               # 策略的具体执行方案
    alternative_strategies: list[str] = field(default_factory=list)  # 备选策略
    
    # 补全状态
    is_filled: bool = False                 # 是否已补全
    filled_by: str = ""                     # 补全方式
    filled_material_id: str = ""            # 补全用的素材 ID
    fill_quality: str = ""                  # 补全质量评估（自然/勉强/突兀）


@dataclass
class MaterialInventory:
    """素材清单：用户素材 + 缺口列表"""
    items: list[MaterialItem] = field(default_factory=list)
    gaps: list[MaterialGap] = field(default_factory=list)
    coverage_rate: float = 0                # 素材覆盖率 0-1
    
    # 统计信息
    face_material_count: int = 0            # 有人脸的素材数量
    scene_material_count: int = 0           # 风景/场景素材数量
    text_material_count: int = 0            # 文本素材数量
    
    def get_filled_gaps(self) -> list[MaterialGap]:
        return [g for g in self.gaps if g.is_filled]
    
    def get_unfilled_gaps(self) -> list[MaterialGap]:
        return [g for g in self.gaps if not g.is_filled]
    
    def get_high_priority_gaps(self, threshold: int = 3) -> list[MaterialGap]:
        return [g for g in self.gaps if not g.is_filled and g.priority >= threshold]
    
    def get_items_by_shot_type(self, shot_type: ShotType) -> list[MaterialItem]:
        return [m for m in self.items if shot_type in m.suitable_for]
    
    def get_face_items(self) -> list[MaterialItem]:
        return [m for m in self.items if m.has_face]
```

### 3.4 scheme.py — 完整定义

```python
"""
视频方案：Planner 产出、Assembler 消费、Reviewer 审核的核心对象
"""

from dataclasses import dataclass, field
from typing import Optional
from models.video_structure import (
    ShotType, TransitionType, PackagingStyle, RhythmPoint
)


@dataclass
class StoryboardFrame:
    """分镜表中的一帧"""
    index: int                              # 帧序号
    start_time: float                       # 开始时间
    end_time: float                         # 结束时间
    duration: float                         # 时长
    
    # 内容
    purpose: str                            # 结构目的（hook/scene_build/process/climax/...）
    shot_type: ShotType = ShotType.DAILY_MOMENT
    visual_content: str = ""                # 画面内容描述
    material_id: str = ""                   # 使用的素材 ID
    is_generated: bool = False              # 素材是否为 AI 生成
    
    # 文本层
    subtitle_text: str = ""                 # 字幕
    voiceover_text: str = ""                # 旁白
    text_card_content: str = ""             # 如果是文字卡，内容是什么
    text_card_style: dict = field(default_factory=dict)  # 文字卡样式配置
    
    # 视觉层
    transition: TransitionType = TransitionType.CUT
    camera_note: str = ""                   # 运镜/动效建议
    motion_effect: str = ""                 # 动态效果：ken_burns/zoom_in/static/focus_scan
    packaging_note: str = ""                # 其他包装说明
    
    # 情绪/节奏
    emotion: str = ""                       # 情绪标签
    rhythm_intensity: float = 0.5           # 节奏强度 0-1
    bgm_sync: bool = False                  # 是否卡 BGM 节拍
    
    # 缺口补全标记
    gap_filled: bool = False                # 是否为缺口补全帧
    gap_fill_strategy: str = ""             # 使用的补全策略


@dataclass
class VideoScheme:
    """完整视频方案"""
    id: str
    title: str = ""
    
    # 关联
    source_structure_ids: list[str] = field(default_factory=list)
    target_topic: str = ""
    target_category: str = "vlog"           # 品类
    target_duration: float = 0              # 目标时长
    target_platform: str = "抖音"
    
    # Vlog 专属
    narrative_type: str = ""                # 叙事主线：timeline/emotion/event
    structure_type: str = ""                # 结构类型
    hook_strategy: str = ""                 # Hook 策略描述
    emotion_arc: list[dict] = field(default_factory=list)   # 情绪曲线
    overall_emotion: str = ""               # 整体情绪基调
    
    # 脚本
    script_blocks: list[dict] = field(default_factory=list)
    
    # 分镜表
    storyboard: list[StoryboardFrame] = field(default_factory=list)
    
    # 节奏
    rhythm_curve: list[RhythmPoint] = field(default_factory=list)
    bgm_suggestion: dict = field(default_factory=dict)
    
    # 包装
    packaging: PackagingStyle = field(default_factory=PackagingStyle)
    color_grade: str = ""
    filter_style: str = ""
    
    # 素材
    material_ids: list[str] = field(default_factory=list)
    gap_ids: list[str] = field(default_factory=list)
    
    # 设计说明（迁移逻辑的可解释性）
    design_explanation: dict = field(default_factory=dict)
    
    # 状态
    version: int = 1
    status: str = "draft"                   # draft / review / final
    review_notes: list[str] = field(default_factory=list)
    change_log: list[dict] = field(default_factory=list)  # 迭代修改日志
    
    # 渲染
    render_path: Optional[str] = None
    render_config: dict = field(default_factory=dict)
```

### 3.5 knowledge.py — 完整定义

```python
"""知识条目模型（Phase 4 使用）"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class KnowledgeType(str, Enum):
    # 通用类型
    STRUCTURE_TEMPLATE = "structure_template"
    EDITING_TECHNIQUE = "editing_technique"
    PACKAGING_STYLE = "packaging_style"
    RHYTHM_PATTERN = "rhythm_pattern"
    CASE_INDEX = "case_index"
    INSIGHT = "insight"
    
    # Vlog 专用类型
    NARRATIVE_PATTERN = "narrative_pattern"     # 叙事模式
    HOOK_TECHNIQUE = "hook_technique"           # Hook 手法
    EMOTION_DESIGN = "emotion_design"           # 情绪曲线设计
    EMPTY_SHOT_USAGE = "empty_shot_usage"       # 空镜头使用技巧
    PERSONA_STYLE = "persona_style"             # 人物出镜风格


@dataclass
class KnowledgeEntry:
    """一条知识"""
    id: str
    type: KnowledgeType
    title: str
    content: str                                    # 自然语言描述
    structured_data: dict = field(default_factory=dict)  # 结构化数据
    tags: list[str] = field(default_factory=list)    # 标签
    source_ids: list[str] = field(default_factory=list)  # 来源视频 ID
    applicable_scenarios: list[str] = field(default_factory=list)  # 适用场景
    confidence: float = 1.0
    usage_count: int = 0
    created_at: str = ""
    embedding: Optional[list[float] = None           # 向量（Phase 4）
```

---

## 第四章 Agent 定义

### 4.1 Agent 基类

```python
# agents/base.py

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional
from enum import Enum
import time


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
class AgentResult:
    """Agent 执行结果"""
    success: bool
    data: Any = None
    message: str = ""
    next_action: Optional[str] = None
    needs_human_review: bool = False
    execution_time: float = 0               # 执行耗时


class BaseAgent(ABC):
    """
    Agent 基类
    
    每个 Agent 的生命周期：
    1. 初始化：注入 LLM 服务和其他工具
    2. execute()：接收输入数据，执行业务逻辑，返回结果
    3. 内部调用 think() 做 LLM 推理，调用工具做数据处理
    
    Agent 之间不直接通信，全部通过 LangGraph State 间接协作。
    """
    
    def __init__(self, role: AgentRole, llm_service=None):
        self.role = role
        self.llm = llm_service
    
    @abstractmethod
    async def execute(self, state: dict) -> dict:
        """
        执行任务。
        输入：完整的 ViralEngineState（Agent 自行读取需要的字段）
        输出：需要写回 State 的字段（dict 形式，由 LangGraph 合并）
        """
        pass
    
    async def think(self, context: str, question: str, 
                    response_format: str = "") -> str:
        """调用 LLM 推理"""
        if not self.llm:
            raise RuntimeError(f"Agent {self.role} 未配置 LLM 服务")
        prompt = f"背景信息：\n{context}\n\n任务：\n{question}"
        return await self.llm.chat(prompt, response_format=response_format)
    
    def parse_json(self, text: str) -> dict:
        """安全解析 LLM 输出的 JSON"""
        import json, re
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r'```(?:json)?\s*(.*?)\s*```', text, re.DOTALL)
            if match:
                return json.loads(match.group(1))
            for sc, ec in [('{', '}'), ('[', ']')]:
                s, e = text.find(sc), text.rfind(ec)
                if s != -1 and e != -1:
                    try:
                        return json.loads(text[s:e+1])
                    except json.JSONDecodeError:
                        pass
        raise ValueError(f"JSON 解析失败: {text[:200]}...")
```

### 4.2 六个 Agent 的职责、输入、输出、工具汇总

#### ① AnalystAgent

```
角色：资深短视频内容分析师
职责：将一条爆款 Vlog 完整拆解为结构化报告

读取 State 字段：
  sample_videos[当前索引]      → 待分析的视频路径
  domain                      → 品类（"vlog"）

写回 State 字段：
  source_structures           → 追加一个 VideoStructure

内部执行步骤：
  Step 1  VideoProcessor.get_video_info()      → 获取基础信息
  Step 2  VideoProcessor.detect_scene_changes() → 镜头切分
  Step 3  VideoProcessor.extract_frame()        → 逐镜头抽关键帧
  Step 4  VideoProcessor.extract_audio()        → 抽取音频
  Step 5  ASRService.transcribe()               → 语音转写
  Step 6  FaceDetector.detect()                 → 逐帧人脸检测
  Step 7  LLM（逐帧画面分析 Prompt 1.1）        → 每帧的画面理解
  Step 8  LLM（综合结构分析 Prompt 1.2）        → 全局结构化推理
  Step 9  组装 VideoStructure（含 VlogMeta）

调用的工具/服务：
  ┌─────────────────────┬──────────────────────────────────────────┐
  │ 工具                 │ 用途                                     │
  ├─────────────────────┼──────────────────────────────────────────┤
  │ VideoProcessor       │ 视频基础信息、镜头切分、关键帧抽取、音频抽取  │
  │ ASRService (Whisper) │ 语音转文字                               │
  │ FaceDetector         │ 人脸检测（有人脸的镜头标记 has_face）      │
  │ LLMService           │ 逐帧画面分析 + 全局结构推理               │
  └─────────────────────┴──────────────────────────────────────────┘
```

#### ② MaterialManagerAgent

```
角色：Vlog 素材管家
职责：素材入库分析 + 缺口识别（同一 Agent 两次调用，不同 action）

第一次调用 — 素材入库 (ingest)：
  读取 State：user_materials
  写回 State：material_inventory

  内部步骤：
    遍历每个素材 →
      图片：FaceDetector + LLM(Prompt 2.1) → 内容理解 + 质量评估 + 标签
      视频：关键帧抽取 + FaceDetector + LLM(Prompt 2.2) → 高光片段提取
      文本：LLM(Prompt 2.3) → 信息提取 + 金句提取
    汇总 MaterialInventory

第二次调用 — 缺口识别 (find_gaps)：
  读取 State：scheme, material_inventory
  写回 State：gap_report（更新 material_inventory.gaps）

  内部步骤：
    遍历 scheme.storyboard 每一帧 →
      检查是否有匹配素材 →
      无匹配 → 创建 MaterialGap →
      用 LLM(Prompt 2.4) 评估影响 + 建议策略 →
    计算覆盖率

调用的工具/服务：
  ┌─────────────────────┬──────────────────────────────────────────┐
  │ 工具                 │ 用途                                     │
  ├─────────────────────┼──────────────────────────────────────────┤
  │ LLMService           │ 素材内容理解、缺口评估推理                │
  │ FaceDetector         │ 人脸检测（素材入库时标注 has_face）       │
  │ VideoProcessor       │ 视频素材关键帧抽取、视频信息获取          │
  └─────────────────────┴──────────────────────────────────────────┘
```

#### ③ PlannerAgent

```
角色：Vlog 赛道金牌编导
职责：基于爆款结构 + 新内容 + 素材情况，制定完整的 Vlog 迁移方案
      这是全系统 LLM 调用最密集、Prompt 最复杂的 Agent

读取 State 字段：
  source_structures[0]        → 爆款结构分析结果
  material_inventory          → 可用素材清单
  target_topic                → 新 Vlog 主题
  target_info                 → 详细信息
  user_preferences            → 用户偏好
  knowledge_refs              → 知识库参考（Phase 1 为空）
  review_result               → 审核反馈（迭代时）
  scheme                      → 上一版方案（迭代时）

写回 State 字段：
  scheme                      → VideoScheme

内部执行步骤：
  Step 1  LLM(Prompt 4.1) → 从爆款结构中提取可迁移的结构骨架
  Step 2  叙事线决策 → 根据用户素材特征选择 timeline/emotion/event
  Step 3  LLM(Prompt 4.2) → 生成完整迁移方案（脚本+分镜+包装+节奏+设计说明）
  Step 4  组装 VideoScheme 对象

迭代时（有 review_result）：
  Step 1  LLM(Prompt 4.3) → 根据审核意见修改方案
  Step 2  组装新版 VideoScheme

调用的工具/服务：
  ┌─────────────────────┬──────────────────────────────────────────┐
  │ 工具                 │ 用途                                     │
  ├─────────────────────┼──────────────────────────────────────────┤
  │ LLMService           │ 结构模式提取、方案生成、迭代修改          │
  │ KnowledgeStore       │ 检索相关知识（Phase 4，Phase 1 为空操作） │
  └─────────────────────┴──────────────────────────────────────────┘
```

#### ④ CreativeAgent

```
角色：Vlog 创意补全专家
职责：针对素材缺口，用最低成本产出最好的补全方案

读取 State 字段：
  gap_report                  → 缺口列表（取高优先级）
  material_inventory          → 现有素材（用于复用）
  target_topic + target_info  → 主题信息
  scheme                      → 当前方案（风格指引）

写回 State 字段：
  generated_materials         → 生成的素材列表
  material_inventory          → 更新（新素材追加 + 缺口标记填充）

内部执行步骤：
  Step 1  LLM(Prompt 5.1) → 对每个缺口制定补全策略
  Step 2  按策略执行：
          策略"素材复用"       → VideoProcessor 裁切/变速/镜像
          策略"Ken Burns"      → VideoProcessor.apply_ken_burns()
          策略"文字卡替代"     → LLM(Prompt 5.2) 生成文案 + VideoProcessor.generate_text_card()
          策略"旁白串联"       → LLM(Prompt 5.3) 生成旁白文案
          策略"结构重排"       → 更新 scheme 中的分镜顺序
          策略"空镜头填充"     → VideoProcessor 从现有素材提取空镜头
  Step 3  将新素材存入文件系统 + 创建 MaterialItem
  Step 4  更新 material_inventory + 标记已填充的缺口

调用的工具/服务：
  ┌─────────────────────┬──────────────────────────────────────────┐
  │ 工具                 │ 用途                                     │
  ├─────────────────────┼──────────────────────────────────────────┤
  │ LLMService           │ 补全策略决策、文案卡生成、旁白生成        │
  │ VideoProcessor       │ 裁切、变速、Ken Burns、文字卡生成、       │
  │                      │ 空镜头提取                               │
  │ FaceDetector         │ Ken Burns 对焦到人脸区域                 │
  │ ImageGenService      │ T2I 图片生成（Phase 2）                  │
  │ TTSService           │ TTS 配音（Phase 2）                      │
  └─────────────────────┴──────────────────────────────────────────┘
```

#### ⑤ AssemblerAgent

```
角色：Vlog 合成师
职责：将方案 + 素材合成为最终视频
     Phase 1 用 FFmpeg，Phase 3 切换 Remotion

读取 State 字段：
  scheme                      → 分镜表 + 包装配置 + 节奏设计
  material_inventory          → 所有素材（含 AI 生成的）

写回 State 字段：
  rendered_video_path         → 输出视频路径

内部执行步骤：
  Step 1  校验每个分镜帧的素材是否就绪
  Step 2  逐帧处理：
          图片素材 → apply_motion_effect (Ken Burns / zoom / static) → 转为视频片段
          视频素材 → 按起止时间裁切
          文字卡   → generate_text_card (color + drawtext)
  Step 3  逐帧叠加字幕（drawtext 滤镜，样式从 packaging_config 读取）
  Step 4  逐帧设置转场（cut / fade / dissolve）
  Step 5  按顺序拼接所有片段（concat）
  Step 6  叠加音频轨（如有 BGM/旁白）
  Step 7  基础调色（eq 滤镜，从 color_grade 配置读取参数）
  Step 8  编码输出 H.264 MP4

调用的工具/服务：
  ┌─────────────────────┬──────────────────────────────────────────┐
  │ 工具                 │ 用途                                     │
  ├─────────────────────┼──────────────────────────────────────────┤
  │ FFmpeg               │ 视频裁切、拼接、字幕、转场、调色、编码    │
  │ VideoProcessor       │ 封装 FFmpeg 操作的上层接口               │
  │ RendererService      │ Remotion 渲染（Phase 3）                 │
  └─────────────────────┴──────────────────────────────────────────┘

注意：这个 Agent 不需要 LLM，是纯工程逻辑。
```

#### ⑥ ReviewerAgent

```
角色：严苛但公正的 Vlog 内容审核专家
职责：评估迁移方案质量，决定通过还是打回

读取 State 字段：
  scheme                      → 待审核的方案
  source_structures[0]        → 原始爆款参照
  rendered_video_path         → 合成视频路径（Phase 2 用）
  material_inventory          → 素材覆盖情况

写回 State 字段：
  review_result               → {scores, total_score, pass, issues, suggestions}

内部执行步骤：
  Step 1  收集评估上下文（方案详情 + 原始爆款摘要 + 覆盖率）
  Step 2  LLM(Prompt 7.1) → 8维度评估打分
  Step 3  计算加权总分
  Step 4  判断是否通过（≥60分）
  Step 5  不通过时输出修改建议

Vlog 专属评估维度（8个）：
  1. 结构保真度（权重×1）    — 是否保留了爆款的结构骨架
  2. Hook 吸引力（权重×1.5） — 前3秒是否足够抓人 ★Vlog 核心
  3. 内容适配度（权重×1）    — 新内容与结构是否适配
  4. 节奏合理性（权重×1）    — 快慢交替是否有呼吸感
  5. 情绪连贯性（权重×1.2）  — 整体情绪是否一致 ★Vlog 重要
  6. 缺口补全质量（权重×1）  — 补全部分是否自然
  7. 包装视觉一致性（权重×0.8）— 字幕/滤镜/转场是否统一
  8. 完整可执行性（权重×0.5）— 方案是否可落地

调用的工具/服务：
  ┌─────────────────────┬──────────────────────────────────────────┐
  │ 工具                 │ 用途                                     │
  ├─────────────────────┼──────────────────────────────────────────┤
  │ LLMService           │ 多维度评估打分、修改建议生成              │
  │ VideoProcessor       │ 合成视频关键帧抽取（Phase 2 视觉审核）   │
  └─────────────────────┴──────────────────────────────────────────┘
```

### 4.3 Agent 工具依赖总表

```
                    LLM   FFmpeg  Whisper  FaceDet  T2I   T2V   TTS   Remotion  知识库
                    ────  ──────  ───────  ───────  ───   ───   ───   ────────  ─────
① Analyst           ✅     ✅      ✅       ✅       ·     ·     ·      ·        ·
② Material Mgr      ✅     ✅      ·        ✅       ·     ·     ·      ·        ·
③ Knowledge         ✅     ·       ·        ·        ·     ·     ·      ·        ✅
④ Planner           ✅     ·       ·        ·        ·     ·     ·      ·        ·(读)
⑤ Creative          ✅     ✅      ·        ✅      ⬜P2  ⬜P2  ⬜P2     ·        ·
⑥ Assembler         ·      ✅      ·        ·        ·     ·     ·     ⬜P3      ·
⑦ Reviewer          ✅    ⬜P2      ·        ·        ·     ·     ·      ·        ·
```

---

## 第五章 Pipeline / LangGraph 图

### 5.1 State 定义

```python
# graph/state.py

from typing import TypedDict, Any, Optional


class ViralEngineState(TypedDict):
    """LangGraph 全局状态 — 所有节点共享的"工作记忆" """
    
    # ===== 输入区 =====
    sample_videos: list[str]                # 爆款视频路径列表
    user_materials: list[dict]              # 用户上传的素材列表
    target_topic: str                       # 新 Vlog 主题
    target_info: dict                       # 主题详情（地点/时间/人物/心情等）
    user_preferences: dict                  # 用户偏好（平台/时长/风格/叙事类型）
    
    # ===== Vlog 专属输入 =====
    domain: str                             # 品类："vlog"
    vlog_style_preference: str              # Vlog 风格偏好：清新/胶片/电影感/活力/治愈
    narrative_type_hint: str                # 用户指定的叙事类型（可选）
    persona_config: dict                    # 人物出镜配置（可选）
    
    # ===== 过程区 — 各节点的产出 =====
    video_index: int                        # 当前分析到第几条视频
    source_structures: list                 # [VideoStructure, ...]
    material_inventory: Any                 # MaterialInventory
    scheme: Any                             # VideoScheme
    knowledge_refs: list                    # [KnowledgeEntry, ...]（Phase 4）
    gap_report: dict                        # 缺口报告摘要
    generated_materials: list               # [MaterialItem, ...]  AI 生成的素材
    rendered_video_path: str                # 合成视频路径
    review_result: dict                     # 审核结果
    
    # ===== 控制区 =====
    current_stage: str                      # 当前阶段名
    iteration: int                          # 当前迭代轮次
    max_iterations: int                     # 最大迭代次数（默认3）
    errors: list[str]                       # 错误列表
    logs: list[dict]                        # 执行日志
```

### 5.2 图结构

```python
# graph/builder.py（伪代码，展示拓扑结构）

from langgraph.graph import StateGraph, END
from graph.state import ViralEngineState
from graph.nodes import (
    analyze_video, ingest_materials, plan_scheme,
    check_gaps, fill_gaps, assemble_video, 
    review_result, store_knowledge
)
from graph.routes import (
    route_after_analyze, route_after_gap_check, route_after_review
)

def build_graph() -> StateGraph:
    graph = StateGraph(ViralEngineState)
    
    # ===== 注册节点 =====
    graph.add_node("analyze_video", analyze_video.run)
    graph.add_node("ingest_materials", ingest_materials.run)
    graph.add_node("plan_scheme", plan_scheme.run)
    graph.add_node("check_gaps", check_gaps.run)
    graph.add_node("fill_gaps", fill_gaps.run)
    graph.add_node("assemble_video", assemble_video.run)
    graph.add_node("review_result", review_result.run)
    # graph.add_node("store_knowledge", store_knowledge.run)  # Phase 4
    
    # ===== 注册边 =====
    graph.set_entry_point("analyze_video")
    
    # 分析完一条 → 判断是否还有下一条
    graph.add_conditional_edges(
        "analyze_video",
        route_after_analyze,             # → "analyze_video" 或 "ingest_materials"
    )
    
    graph.add_edge("ingest_materials", "plan_scheme")
    # graph.add_edge("plan_scheme", "store_knowledge")  # Phase 4 并行
    
    graph.add_edge("plan_scheme", "check_gaps")
    
    # 缺口检查后 → 判断是否需要补全
    graph.add_conditional_edges(
        "check_gaps",
        route_after_gap_check,           # → "fill_gaps" 或 "assemble_video"
    )
    
    graph.add_edge("fill_gaps", "assemble_video")
    graph.add_edge("assemble_video", "review_result")
    
    # 审核后 → 通过 / 迭代 / 超限
    graph.add_conditional_edges(
        "review_result",
        route_after_review,              # → "plan_scheme" 或 END
    )
    
    return graph.compile()
```

### 5.3 图拓扑可视化

```
                    ┌───────────┐
                    │   START   │
                    └─────┬─────┘
                          │
                          ▼
              ┌──────────────────────┐
              │    analyze_video     │◄─────────────────────────┐
              │  (分析第N条爆款)      │                          │
              └──────────┬───────────┘                          │
                         │                                      │
                    route_after_analyze                         │
                         │                                      │
                    还有未分析的？                                │
                   Yes ──┤── No                                 │
                   │          │                                 │
                   └──────────┼──────────────────────────────┐  │
                              │                              │  │
                              ▼                              │  │
                 ┌──────────────────────┐                    │  │
                 │  ingest_materials    │                    │  │
                 │  (素材入库与理解)      │                    │  │
                 └──────────┬───────────┘                    │  │
                            │                                │  │
                            ▼                                │  │
                 ┌──────────────────────┐                    │  │
                 │    plan_scheme       │◄────────────────┐  │  │
                 │  (生成迁移方案)       │                 │  │  │
                 └──────────┬───────────┘                 │  │  │
                            │                             │  │  │
                            ▼                             │  │  │
                 ┌──────────────────────┐                 │  │  │
                 │    check_gaps        │                 │  │  │
                 │  (识别素材缺口)       │                 │  │  │
                 └──────────┬───────────┘                 │  │  │
                            │                             │  │  │
                       route_after_gap_check              │  │  │
                            │                             │  │  │
                      有高优先级缺口？                      │  │  │
                     Yes ──┤── No                         │  │  │
                     │          │                         │  │  │
                     ▼          │                         │  │  │
              ┌──────────────┐  │                         │  │  │
              │  fill_gaps   │  │                         │  │  │
              │ (补全缺口)    │  │                         │  │  │
              └──────┬───────┘  │                         │  │  │
                     │          │                         │  │  │
                     └────┬─────┘                         │  │  │
                          │                               │  │  │
                          ▼                               │  │  │
              ┌──────────────────────┐                    │  │  │
              │  assemble_video      │                    │  │  │
              │  (合成视频)           │                    │  │  │
              └──────────┬───────────┘                    │  │  │
                         │                                │  │  │
                         ▼                                │  │  │
              ┌──────────────────────┐                    │  │  │
              │  review_result       │                    │  │  │
              │  (审核评估)           │                    │  │  │
              └──────────┬───────────┘                    │  │  │
                         │                                │  │  │
                    route_after_review                     │  │  │
                         │                                │  │  │
                ┌────────┼────────┐                       │  │  │
                │        │        │                       │  │  │
             pass    未通过且     超过最大                   │  │  │
                │     可迭代      迭代次数                   │  │  │
                │        │        │                       │  │  │
                ▼        │        ▼                       │  │  │
              ┌───┐      │      ┌──────────┐              │  │  │
              │END│      │      │END(带警告)│              │  │  │
              └───┘      │      └──────────┘              │  │  │
                         │                                │  │  │
                         └────────────────────────────────┘  │  │
                          (回到 plan_scheme，iteration++)     │  │
                                                             │  │
                         ┌───────────────────────────────────┘  │
                         │  (未分析的视频，回到 analyze_video)    │
                         └──────────────────────────────────────┘
```

### 5.4 条件路由函数

```python
# graph/routes.py

def route_after_analyze(state: ViralEngineState) -> str:
    """分析完一条爆款视频后的路由"""
    next_index = state["video_index"] + 1
    if next_index < len(state["sample_videos"]):
        return "analyze_video"          # 还有未分析的，继续
    else:
        return "ingest_materials"       # 全部分析完了，进入素材入库


def route_after_gap_check(state: ViralEngineState) -> str:
    """缺口检查后的路由"""
    inventory = state["material_inventory"]
    
    # 取出所有未填充的高优先级缺口
    high_priority = inventory.get_high_priority_gaps(threshold=3)
    
    # Vlog 特殊规则：有人脸缺口（hook/persona 类型）即使 priority 低也要补
    face_critical_gaps = [
        g for g in inventory.get_unfilled_gaps()
        if g.required_type in (ShotType.HOOK, ShotType.PERSONA_EXPRESSION)
        and not g.is_filled
    ]
    
    if high_priority or face_critical_gaps:
        return "fill_gaps"              # 有需要补的缺口
    else:
        return "assemble_video"         # 无需补全，直接合成


def route_after_review(state: ViralEngineState) -> str:
    """审核后的路由"""
    review = state.get("review_result", {})
    iteration = state.get("iteration", 0)
    max_iter = state.get("max_iterations", 3)
    
    if review.get("pass"):
        return "__end__"                # 通过，结束
    
    # Vlog 特殊规则：hook 得分 < 4 必须强制迭代
    hook_score = review.get("scores", {}).get("hook_appeal", {}).get("score", 10)
    
    if iteration < max_iter:
        return "plan_scheme"            # 未超限，迭代优化
    else:
        return "__end__"                # 超限，输出当前最优
```

---

## 第六章 Services 层

### 6.1 LLMService

```python
# services/llm_service.py

class LLMService:
    """统一封装 LLM 调用"""
    
    def __init__(self, api_key, base_url, model):
        # 初始化 HTTP 客户端
    
    async def chat(self, prompt, system="", response_format="") -> str:
        """调用 LLM，返回文本"""
        # 支持 response_format="json" 强制 JSON 输出
    
    def parse_json(self, text) -> dict:
        """安全解析 JSON"""
```

### 6.2 VideoProcessor

```python
# services/video_processor.py

class VideoProcessor:
    """FFmpeg + OpenCV 封装"""
    
    # ===== 原有方法 =====
    def get_video_info(self, video_path) -> dict:
        """获取视频元信息：时长/分辨率/帧率/编码"""
    
    def detect_scene_changes(self, video_path, threshold=0.3) -> list[dict]:
        """镜头切分：返回 [{start, end, duration}, ...]"""
    
    def extract_frame(self, video_path, time_sec) -> str:
        """抽取指定时间的关键帧，返回图片路径"""
    
    def extract_audio(self, video_path) -> str:
        """抽取音频轨，返回 WAV 路径"""
    
    # ===== Vlog 扩展方法 =====
    def apply_ken_burns(self, image_path, config, duration) -> str:
        """
        Ken Burns 效果：静态图 → 动态视频片段
        config: {type: "zoom_in"/"pan_left"/"focus_scan", 
                 start_region: [x,y,w,h], end_region: [x,y,w,h],
                 speed: "slow"/"medium"}
        返回: 视频片段路径
        FFmpeg: zoompan 滤镜
        """
    
    def generate_text_card(self, text, style, duration) -> str:
        """
        生成文字卡视频片段
        style: {bg_color, font, font_size, text_color, animation}
        返回: 视频片段路径
        FFmpeg: color 滤镜 + drawtext
        """
    
    def apply_speed_change(self, video_path, factor) -> str:
        """
        变速处理
        factor: 0.5 = 慢放一半, 2.0 = 快放一倍
        FFmpeg: setpts 滤镜
        """
    
    def apply_reverse(self, video_path) -> str:
        """倒放处理"""
    
    def apply_basic_color_grade(self, video_path, grade_config) -> str:
        """
        基础调色
        grade_config: {brightness, contrast, saturation, temperature}
        FFmpeg: eq 滤镜
        """
    
    def extract_highlight_clip(self, video_path, start, end) -> str:
        """截取高光片段"""
    
    def concat_clips(self, clip_paths, transition_type, transition_duration) -> str:
        """
        拼接多个视频片段，带转场
        FFmpeg: concat / xfade 滤镜
        """
    
    def overlay_subtitle(self, video_path, subtitle_config) -> str:
        """
        叠加字幕
        subtitle_config: {text, font, size, color, stroke, position, start, end}
        FFmpeg: drawtext 滤镜
        """
```

### 6.3 FaceDetector

```python
# services/face_detector.py

class FaceDetector:
    """人脸检测服务"""
    
    def detect(self, image_path) -> list[dict]:
        """
        检测图片中所有人脸
        返回: [{"bbox": (x,y,w,h), "confidence": 0.95, "area_ratio": 0.12}]
        """
    
    def has_face(self, image_path) -> bool:
        """快速判断是否有脸"""
    
    def get_main_face_region(self, image_path) -> Optional[tuple]:
        """
        获取最大人脸的区域（用于 Ken Burns 对焦）
        返回: (x, y, w, h) 或 None
        """
    
    def get_face_crop(self, image_path, expand_ratio=1.5) -> str:
        """
        以人脸为中心裁切图片（用于素材复用，一张图出多个"镜头"）
        expand_ratio: 裁切区域相对于人脸的扩展倍数
        返回: 裁切后的图片路径
        """
```

### 6.4 ASRService

```python
# services/asr_service.py

class ASRService:
    """语音转写服务（Whisper）"""
    
    def __init__(self, model_size="base"):
        # 加载 Whisper 模型
    
    def transcribe(self, audio_path, language="zh") -> str:
        """转写为完整文本"""
    
    def transcribe_with_timestamps(self, audio_path, language="zh") -> list[dict]:
        """
        带时间戳的转写
        返回: [{"start": 0.0, "end": 2.5, "text": "..."}, ...]
        """
```

---

## 第七章 Prompts 层

### 7.1 Prompt 组织方式

所有 Prompt 模板放在 `prompts/` 目录下，与 Agent 解耦。每个 Prompt 是一个 Python 函数，接收参数后返回格式化的 Prompt 字符串。

```python
# prompts/analyst_prompts.py

def build_shot_analysis_prompt(shot_index, start_time, end_time, 
                                total_duration, prev_frame_desc) -> str:
    """Prompt 1.1：单镜头画面分析"""
    return f"""你是一位有8年经验的短视频内容分析师...
    (完整 Prompt 见之前的设计)
    """

def build_structure_analysis_prompt(basic_info, shot_analyses, transcript) -> str:
    """Prompt 1.2：综合结构分析"""
    return f"""你是一位抖音 Vlog 赛道的资深编导...
    (完整 Prompt 见之前的设计)
    """
```

### 7.2 Phase 1 使用的 Prompt 清单

```
prompts/
├── analyst_prompts.py
│   ├── build_shot_analysis_prompt()        # Prompt 1.1 — 逐帧画面分析
│   └── build_structure_analysis_prompt()   # Prompt 1.2 — 综合结构分析
│
├── material_prompts.py
│   ├── build_image_analysis_prompt()       # Prompt 2.1 — 图片素材分析
│   ├── build_video_analysis_prompt()       # Prompt 2.2 — 视频素材分析
│   ├── build_text_analysis_prompt()        # Prompt 2.3 — 文本素材分析
│   └── build_gap_check_prompt()            # Prompt 2.4 — 缺口识别推理
│
├── planner_prompts.py
│   ├── build_skeleton_extract_prompt()     # Prompt 4.1 — 结构骨架提取
│   ├── build_scheme_generate_prompt()      # Prompt 4.2 — 迁移方案生成
│   └── build_scheme_iterate_prompt()       # Prompt 4.3 — 迭代优化
│
├── creative_prompts.py
│   ├── build_fill_strategy_prompt()        # Prompt 5.1 — 补全策略决策
│   └── build_text_card_prompt()            # Prompt 5.2 — 文案卡生成
│
└── reviewer_prompts.py
    └── build_review_prompt()               # Prompt 7.1 — 方案质量评估

Phase 1 共 11 个 Prompt
```

---

## 第八章 Phase 1 完整实施计划

### 8.1 Phase 1 目标

**跑通 Vlog 场景下的完整核心闭环**：

```
爆款 Vlog 输入 → 结构分析 → 新素材入库 → 方案生成 → 缺口识别 
→ 基础补全 → 视频合成 → 审核评估 → [迭代] → 输出结果
```

### 8.2 Phase 1 范围

```
实现的节点（✅） vs 不实现的节点（⬜）：

  analyze_video      ✅ Phase 1
  ingest_materials   ✅ Phase 1
  plan_scheme        ✅ Phase 1
  check_gaps         ✅ Phase 1
  fill_gaps          ✅ Phase 1（部分策略）
  assemble_video     ✅ Phase 1（FFmpeg 简化版）
  review_result      ✅ Phase 1（纯文本审核）
  store_knowledge    ⬜ Phase 4
```

**Phase 1 实现的补全策略**：

| 策略 | Phase 1 | 说明 |
|------|---------|------|
| 现有素材重组复用 | ✅ | 裁切、镜像、变速 |
| Ken Burns 效果 | ✅ | 静态图动态化 |
| 文字卡替代 | ✅ | 纯色背景+文字 |
| 结构重排 | ✅ | 调整分镜顺序 |
| 旁白串联 | ⬜ | Phase 2（需要 TTS 才能落地） |
| T2I 图片生成 | ⬜ | Phase 2 |
| T2V 视频生成 | ⬜ | Phase 2 |
| TTS 配音 | ⬜ | Phase 2 |
| Remotion 渲染 | ⬜ | Phase 3 |
| 知识库 | ⬜ | Phase 4 |

### 8.3 Phase 1 各节点实现细节

#### 节点 1：analyze_video

```
节点函数签名：
  async def run(state: ViralEngineState) -> dict

读取 State：
  sample_videos, video_index, domain

写回 State：
  source_structures (追加), video_index (自增), logs (追加)

内部流程：
  1. 取 sample_videos[video_index]
  2. video_proc.get_video_info() → 基础信息
  3. video_proc.detect_scene_changes() → 镜头列表
  4. 遍历镜头：
     a. video_proc.extract_frame() → 关键帧
     b. face_detector.has_face() → 是否有人脸
     c. llm.chat(Prompt 1.1) → 画面分析结果
  5. video_proc.extract_audio() → 音频文件
  6. asr.transcribe_with_timestamps() → 转写文本
  7. llm.chat(Prompt 1.2) → 综合结构分析
  8. 组装 VideoStructure（含 VlogMeta）
  9. 写回 state

错误处理：
  - 镜头切分失败 → 降级为等间隔切分（每3秒一个镜头）
  - ASR 失败 → transcript 标记为空，结构分析不依赖转写
  - LLM 返回非法 JSON → 重试一次，仍失败则记录错误
```

#### 节点 2：ingest_materials

```
节点函数签名：
  async def run(state: ViralEngineState) -> dict

读取 State：
  user_materials

写回 State：
  material_inventory, logs

内部流程：
  1. 遍历 user_materials
  2. 按类型分发：
     - 图片 → face_detector + llm.chat(Prompt 2.1)
     - 视频 → video_proc 抽帧 + face_detector + llm.chat(Prompt 2.2)
     - 文本 → llm.chat(Prompt 2.3)
  3. 每个素材 → MaterialItem（含 has_face, emotion_label, suitable_for, quality）
  4. 汇总 MaterialInventory
  5. 统计 face_material_count, scene_material_count
  6. 写回 state

错误处理：
  - 图片无法读取 → 标记为 UNUSABLE，不阻断流程
  - LLM 分析失败 → 用默认标签，quality 标为 MEDIUM
```

#### 节点 3：plan_scheme

```
节点函数签名：
  async def run(state: ViralEngineState) -> dict

读取 State：
  source_structures, material_inventory, target_topic, target_info,
  user_preferences, knowledge_refs, review_result(迭代时), scheme(迭代时)

写回 State：
  scheme, iteration (自增), logs

内部流程：
  首次生成（review_result 为空）：
    1. llm.chat(Prompt 4.1) → 结构骨架提取
    2. 叙事线决策（规则：素材有明确时间线信息→timeline，素材以情绪照为主→emotion，有事件线索→event）
    3. llm.chat(Prompt 4.2) → 完整迁移方案
    4. 组装 VideoScheme
  
  迭代优化（review_result 不为空）：
    1. llm.chat(Prompt 4.3) → 基于审核意见修改
    2. 组装新版 VideoScheme（version++, change_log 追加）

错误处理：
  - LLM 输出格式错误 → 重试一次
  - 素材清单为空 → 在 Prompt 中说明"无可用素材"，让 LLM 尽量用文字卡方案
```

#### 节点 4：check_gaps

```
节点函数签名：
  async def run(state: ViralEngineState) -> dict

读取 State：
  scheme, material_inventory

写回 State：
  material_inventory (更新 gaps), gap_report (摘要), logs

内部流程：
  1. 遍历 scheme.storyboard 每一帧
  2. 检查 frame.material_id 是否在 inventory.items 中有匹配
  3. 无匹配 → 创建 MaterialGap
  4. 用规则计算 priority（hook=5, persona=4, emotion_peak=4, scene=3, daily=2, info=2, closing=2, transition=1）
  5. 用规则映射 suggested_strategy
  6. 可选：llm.chat(Prompt 2.4) 做更精细的缺口评估
  7. 计算 coverage_rate
  8. 写回 state

Vlog 优先级规则：
  priority 5: hook（开头）
  priority 4: persona（人物表达）、emotion_peak（情绪高点）
  priority 3: scene_establish（场景建立）
  priority 2: daily_moment, info_card, closing
  priority 1: transition

策略映射规则：
  hook 缺口          → "素材复用（选最有冲击力的一帧做开头）+ 文字卡叠加悬念字幕"
  persona 缺口       → "素材复用（裁切现有含人脸的素材）+ Ken Burns"
  emotion_peak 缺口  → "Ken Burns + 变速慢放 + 音效强调"
  scene 缺口         → "素材复用（换角度裁切）+ Ken Burns"
  daily_moment 缺口  → "文字卡替代 + 旁白串联"
  closing 缺口       → "最好看的素材做定格 + 渐隐 + 文字卡"
  transition 缺口    → "硬切替代或叠化转场"
```

#### 节点 5：fill_gaps

```
节点函数签名：
  async def run(state: ViralEngineState) -> dict

读取 State：
  material_inventory, scheme, target_topic, target_info

写回 State：
  generated_materials, material_inventory (更新), scheme (可能更新), logs

内部流程：
  1. 取出所有未填充的缺口
  2. 按 priority 降序排列
  3. 对每个缺口调用 llm.chat(Prompt 5.1) 制定补全方案
  4. 按策略执行：

     策略"素材复用"：
       → 从 inventory 中选最匹配的素材
       → video_proc.crop() / apply_speed_change() / mirror
       → 生成新 MaterialItem + 更新对应分镜帧

     策略"Ken Burns"：
       → 确定对焦区域（face_detector.get_main_face_region 或画面中央）
       → video_proc.apply_ken_burns()
       → 生成新 MaterialItem

     策略"文字卡替代"：
       → llm.chat(Prompt 5.2) 生成文案内容
       → video_proc.generate_text_card()
       → 更新对应 StoryboardFrame（设置 text_card_content, material_id）

     策略"结构重排"：
       → 调整 scheme.storyboard 中的顺序
       → 更新时间轴

  5. 所有缺口处理完后，写回 state
```

#### 节点 6：assemble_video

```
节点函数签名：
  async def run(state: ViralEngineState) -> dict

读取 State：
  scheme, material_inventory

写回 State：
  rendered_video_path, logs

内部流程：
  1. 校验所有分镜帧的素材就绪状态
  2. 遍历 scheme.storyboard：

     Step A: 素材 → 视频片段
       if 帧有 text_card_content:
         → video_proc.generate_text_card(text, style, duration)
       elif 素材是图片:
         → video_proc.apply_ken_burns() 或 static loop
       elif 素材是视频:
         → video_proc.extract_highlight_clip()
       elif 素材缺失（兜底）:
         → generate_text_card("...", default_style, duration)

     Step B: 叠加字幕
       if 帧有 subtitle_text:
         → video_proc.overlay_subtitle(片段, subtitle_config)

     Step C: 应用调色
       if scheme.color_grade:
         → video_proc.apply_basic_color_grade(片段, color_grade)

  3. 拼接所有片段
     → video_proc.concat_clips(clips, transitions)

  4. 编码输出 MP4 (H.264, 1080x1920)

  5. 写回 rendered_video_path
```

#### 节点 7：review_result

```
节点函数签名：
  async def run(state: ViralEngineState) -> dict

读取 State：
  scheme, source_structures, rendered_video_path, material_inventory

写回 State：
  review_result, logs

内部流程：
  1. 构建评估上下文：
     - 爆款结构摘要
     - 方案详情（脚本+分镜+包装+节奏+设计说明）
     - 素材覆盖情况（覆盖率、补全部分用什么策略）
  2. llm.chat(Prompt 7.1) → 8维度评估
  3. 计算加权总分：
     total = Σ(score × weight) / Σ(weight)
     weight = {结构×1, Hook×1.5, 适配×1, 节奏×1, 情绪×1.2, 补全×1, 包装×0.8, 完整×0.5}
  4. 判断 pass = total >= 60
  5. 写回 review_result

Vlog 特殊规则：
  如果 hook_appeal score < 4，即使总分 >= 60 也标记为需强制优化
```

### 8.4 Phase 1 里程碑与验收

```
Week 1: 基础设施
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Day 1-2: 项目骨架搭建
  ├── LangGraph 项目结构初始化
  ├── models/ 全部数据模型（含 Vlog 扩展）
  ├── config/settings.py
  └── pyproject.toml 依赖配置

Day 3-4: 工具层封装
  ├── services/llm_service.py（Doubao API 对接验证）
  ├── services/video_processor.py（FFmpeg 基础操作验证）
  ├── services/face_detector.py（OpenCV Haar 验证）
  └── services/asr_service.py（Whisper 验证）

Day 5: Prompt 模板
  ├── prompts/ 全部 11 个 Prompt 函数
  └── 每个 Prompt 用测试数据验证 LLM 输出格式

验收标准：
  □ LLM 可调用并返回 JSON
  □ FFmpeg 可执行镜头切分、关键帧抽取
  □ 人脸检测可正常运行
  □ Whisper 可转写中文音频

Week 2: 分析链路
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Day 1-3: AnalystAgent 实现
  ├── agents/analyst.py
  ├── graph/nodes/analyze_video.py
  └── 逐帧分析 + 综合结构分析 的完整流程

Day 4-5: MaterialManager 第一次调用（素材入库）
  ├── agents/material_manager.py（ingest 部分）
  ├── graph/nodes/ingest_materials.py
  └── 图片/视频/文本三类素材的分析流程

验收标准：
  □ 输入一条 Vlog → 输出完整 VideoStructure（含 VlogMeta）
  □ 输入用户素材 → 输出 MaterialInventory（含人脸标注、情绪标签）
  □ 可视化中间结果（结构拆解报告可读）

Week 3: 方案生成 + 缺口处理
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Day 1-2: PlannerAgent 实现
  ├── agents/planner.py
  ├── graph/nodes/plan_scheme.py
  └── 结构骨架提取 + 方案生成

Day 3: MaterialManager 第二次调用（缺口识别）
  ├── graph/nodes/check_gaps.py
  └── 缺口识别 + 优先级 + 策略映射

Day 4-5: CreativeAgent 实现
  ├── agents/creative.py（素材复用 + Ken Burns + 文字卡 + 结构重排）
  ├── graph/nodes/fill_gaps.py
  └── 补全策略执行

验收标准：
  □ 输入爆款分析 + 用户素材 + 主题 → 输出 VideoScheme
  □ 正确识别素材缺口并给出合理策略
  □ 补全后素材覆盖率显著提升

Week 4: 合成 + 审核 + 闭环
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Day 1-2: AssemblerAgent 实现
  ├── graph/nodes/assemble_video.py
  └── FFmpeg 全链路合成

Day 3: ReviewerAgent 实现
  ├── agents/reviewer.py
  ├── graph/nodes/review_result.py
  └── 8维度评估

Day 4: 图组装与闭环验证
  ├── graph/builder.py（完整图构建）
  ├── graph/routes.py（路由函数）
  ├── main.py（端到端入口）
  └── 迭代优化验证

Day 5: Demo 准备
  ├── 准备 2-3 条爆款 Vlog 测试视频
  ├── 准备不同质量的用户素材集
  ├── 跑通完整流程并录制演示视频
  └── 撰写 Phase 1 项目说明文档

验收标准：
  □ 端到端流程可完整运行
  □ 输出的 Vlog 视频可播放、结构完整
  □ 审核可正确判断质量
  □ 迭代优化有实际效果
```

### 8.5 Phase 1 验收标准对照课题评分

| 课题任务 | Phase 1 覆盖情况 | 预期得分 |
|---------|-----------------|---------|
| **任务1：样例视频输入与解析** | 支持单条/多条输入，展示基础信息（时长/镜头数/字幕概览/封面） | 4-5分 |
| **任务2：结构拆解** | 脚本结构 + 节奏结构 + 包装结构 + Vlog 专属的叙事线/情绪线/人物结构 | 8-10分 |
| **任务3：新内容与素材输入** | 支持图片/视频/文本输入，识别缺口 | 3分 |
| **任务4：结构迁移与结果生成** | 脚本 + 分镜 + 时间线草案 + 包装方案 + 设计说明 | 8-10分 |
| **任务5：素材缺口识别** | 识别结构槽位缺口，含优先级和影响评估 | 6-8分 |
| **任务6：素材缺口补全** | 素材复用 + Ken Burns + 文字卡 + 结构重排（4种策略） | 9-12分 |
| **任务7：迁移过程可视化** | ⬜ Phase 2（暂不可展示中间过程） | 0分 |
| **任务8：结果可验证** | 有视频 demo，有设计说明，缺前后对比 | 6分 |

**Phase 1 预估总分**：44-56分

**Phase 2 增量**（迁移过程可视化 + 前后对比展示）可再增加 14-20 分。

### 8.6 Phase 后续规划（概要）

```
Phase 2 (Week 5-7): 增强创作 + 可视化
  ├── 迁移过程可视化页面（结构对比图、映射关系、缺口标记）
  ├── T2I 补全接入（ImageGenService）
  ├── TTS 旁白补全接入（TTSService）
  ├── 旁白串联策略
  ├── 画面包装生成（字幕样式、标题条、转场建议）
  └── 多版本生成（高点击版/高节奏版/高质感版）

Phase 3 (Week 8-9): 渲染升级 + 人机协同
  ├── Remotion 接入（替代 FFmpeg 合成，支持复杂动画）
  ├── 真实素材适配（镜头分类、高光筛选）
  ├── 人工可调能力（调整 hook/卖点顺序/包装风格/节奏）
  ├── 自然语言编辑（"开头更抓人一些"）
  └── 视觉审核（Prompt 7.2 接入）

Phase 4 (Week 10-12): 知识沉淀 + 打磨
  ├── 知识库体系搭建（Chroma/FAISS）
  ├── KnowledgeAgent 实现（知识提炼 + 检索）
  ├── 知识可视化 Wiki 页面
  ├── 品类扩展准备（好物分享/种草的结构模板）
  ├── 工程质量打磨
  └── 答辩准备
```

---

这份文档覆盖了从系统架构、数据模型、Agent 定义、Pipeline 编排、工具层到 Phase 1 实施计划的完整设计。可以作为后续开发的唯一参考文档使用。需要进一步细化某个模块吗？