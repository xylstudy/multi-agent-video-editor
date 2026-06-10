# 爆款结构迁移引擎 — LangGraph 架构设计 & Phase 1 报告

---

## 一、为什么选 LangGraph

LangGraph 是 LangChain 团队专为 Agent 编排设计的状态图框架，它的核心思想和我们的需求高度吻合：

| 我们的需求 | LangGraph 对应能力 |
|-----------|-------------------|
| 多 Agent 协作 | **Node** 天然对应一个 Agent 的执行单元 |
| 流程有分支 | **条件边（Conditional Edge）** 支持 if/else 路由 |
| 需要迭代循环 | **环形图** 原生支持，review → replanning 就是一个回边 |
| 中间状态要存下来 | **State** 是全局共享的 TypedDict，每个节点都能读写 |
| 流程可解释 | **Graph 的可视化**，调试时直接看执行路径 |
| 可中断恢复 | **Checkpoint** 机制，断点续跑 |

---

## 二、项目骨架（基于 LangGraph）

### 目录结构

```
viral-structure-engine/
│
├── graph/                              # LangGraph 图定义（核心）
│   ├── __init__.py
│   ├── state.py                        # 全局状态定义 (TypedDict)
│   ├── builder.py                      # 图的构建（节点+边的组装）
│   └── nodes/                          # 每个节点 = 一个业务处理单元
│       ├── __init__.py
│       ├── analyze_video.py            # 节点：分析爆款视频
│       ├── ingest_materials.py         # 节点：素材入库与理解
│       ├── plan_scheme.py              # 节点：生成迁移方案
│       ├── check_gaps.py               # 节点：识别素材缺口
│       ├── fill_gaps.py                # 节点：补全缺口
│       ├── assemble_video.py           # 节点：合成视频
│       ├── review_result.py            # 节点：审核结果
│       ├── store_knowledge.py          # 节点：知识沉淀
│       └── route_functions.py          # 条件路由函数集合
│
├── agents/                             # Agent 层（LLM 推理封装）
│   ├── __init__.py
│   ├── base.py                         # Agent 基类
│   ├── analyst.py                      # 视频分析 Agent
│   ├── planner.py                      # 编导 Agent
│   ├── material_manager.py             # 素材管理 Agent
│   ├── creative.py                     # 创作生成 Agent
│   ├── reviewer.py                     # 审核 Agent
│   └── knowledge_agent.py              # 知识提炼 Agent
│
├── models/                             # 数据模型（全系统共享）
│   ├── __init__.py
│   ├── video_structure.py              # 视频结构抽象
│   ├── material.py                     # 素材模型
│   ├── scheme.py                       # 视频方案
│   └── knowledge.py                    # 知识条目
│
├── services/                           # 工具/服务层（可替换实现）
│   ├── __init__.py
│   ├── llm_service.py                  # LLM 调用封装
│   ├── video_processor.py              # FFmpeg / OpenCV
│   ├── asr_service.py                  # 语音转文字
│   ├── tts_service.py                  # 文字转语音
│   ├── image_gen_service.py            # T2I 图片生成
│   ├── video_gen_service.py            # T2V 视频生成
│   └── renderer_service.py             # Remotion 渲染接口
│
├── knowledge/                          # 知识库模块
│   ├── __init__.py
│   ├── store.py                        # 知识存储与检索
│   ├── extractor.py                    # 知识提炼逻辑
│   └── index.py                        # 向量索引
│
├── config/                             # 配置
│   ├── __init__.py
│   └── settings.py                     # 全局配置
│
├── data/                               # 数据目录
│   ├── samples/                        # 示例爆款视频
│   ├── assets/                         # 用户上传素材
│   ├── output/                         # 生成产物
│   └── knowledge_db/                   # 知识库存储
│
├── renderer/                           # Remotion 渲染层（TypeScript）
│   ├── src/
│   │   ├── compositions/
│   │   │   └── VideoProject.tsx
│   │   └── components/
│   ├── package.json
│   └── remotion.config.ts
│
├── tests/                              # 测试
│   ├── test_analyst.py
│   ├── test_planner.py
│   └── test_pipeline.py
│
├── main.py                             # 入口
├── pyproject.toml                      # Python 依赖
└── README.md
```

---

### LangGraph 核心概念映射

#### State — 全局状态定义

State 是 LangGraph 的灵魂。所有节点共享同一个 State 对象，每个节点读取需要的字段、写入产出的字段。

```
graph/state.py 定义的全局状态:

┌─────────────────────────────────────────────────────────────┐
│                    ViralEngineState (TypedDict)              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  【输入区】                                                   │
│  ├── sample_videos: list[str]           # 爆款视频路径       │
│  ├── user_materials: list[dict]         # 用户素材列表       │
│  ├── target_topic: str                  # 新视频主题         │
│  ├── target_info: dict                  # 商品/内容详细信息   │
│  └── user_preferences: dict             # 用户偏好设置       │
│                                                             │
│  【过程区 — 各节点的产出物】                                    │
│  ├── source_structures: list            # VideoStructure列表 │
│  ├── material_inventory: MaterialInventory                   │
│  ├── scheme: VideoScheme                                     │
│  ├── knowledge_refs: list[KnowledgeEntry]                    │
│  ├── gap_report: dict                   # 缺口报告           │
│  ├── generated_materials: list          # AI生成的素材       │
│  ├── rendered_video_path: str                                │
│  └── review_result: dict                                    │
│                                                             │
│  【控制区】                                                   │
│  ├── current_stage: str                 # 当前阶段           │
│  ├── iteration: int                     # 迭代轮次           │
│  ├── max_iterations: int                                    │
│  ├── errors: list[str]                                      │
│  └── logs: list[dict]                   # 执行日志           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Graph — 图结构

```
LangGraph 状态图的完整结构：

                    ┌───────────┐
                    │  START    │
                    └─────┬─────┘
                          │
                          ▼
                ┌─────────────────┐
                │  analyze_video  │  ← 分析爆款视频（可循环多条）
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │ ingest_materials│  ← 素材入库与理解
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐     ┌──────────────────┐
                │  plan_scheme    │────▶│ store_knowledge  │ ← 知识沉淀（并行）
                └────────┬────────┘     └──────────────────┘
                         │
                         ▼
                ┌─────────────────┐
                │   check_gaps    │  ← 识别素材缺口
                └────────┬────────┘
                         │
                    ┌────┴────┐
                    │ 有缺口？ │
                    └────┬────┘
                    Yes  │  No
                    ┌────┴──────┐
                    ▼           │
           ┌──────────────┐    │
           │  fill_gaps   │    │
           └──────┬───────┘    │
                  │            │
                  └─────┬──────┘
                        │
                        ▼
               ┌─────────────────┐
               │ assemble_video  │  ← 合成视频
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │ review_result   │  ← 审核
               └────────┬────────┘
                        │
                   ┌────┴────┐
                   │ 通过？   │
                   └────┬────┘
                   No   │  Yes
            ┌───────────┤
            ▼           │
    ┌──────────────┐    │
    │ plan_scheme  │◄───┘  ← 回到规划节点（迭代优化）
    │  (迭代版)    │
    └──────────────┘
                        │
                        ▼
                   ┌─────────┐
                   │   END   │
                   └─────────┘
```

---

### 各节点职责定义

| 节点名 | 输入（从State读取） | 输出（写入State） | 调用的Agent | 核心逻辑 |
|--------|-------------------|-------------------|------------|---------|
| `analyze_video` | `sample_videos` | `source_structures` | AnalystAgent | 对每条爆款视频做多维度分析，输出 VideoStructure |
| `ingest_materials` | `user_materials` | `material_inventory` | MaterialManager | 分析用户素材内容、打标签、评估质量、匹配适合位置 |
| `plan_scheme` | `source_structures`, `material_inventory`, `target_topic`, `knowledge_refs`, `review_result`(迭代时) | `scheme` | PlannerAgent | 基于爆款结构+新内容+知识库参考，制定迁移方案 |
| `check_gaps` | `scheme`, `material_inventory` | `gap_report` | MaterialManager | 将方案需求与可用素材做匹配，输出缺口清单 |
| `fill_gaps` | `gap_report`, `target_info` | `generated_materials`, `material_inventory`(更新) | CreativeAgent | 根据缺口类型选择补全策略，调用 T2I/T2V/TTS/LLM 生成 |
| `assemble_video` | `scheme`, `material_inventory` | `rendered_video_path` | AssemblerAgent | 调用 Remotion/FFmpeg 将方案+素材合成为视频 |
| `review_result` | `scheme`, `source_structures`, `rendered_video_path` | `review_result` | ReviewerAgent | 评估迁移质量，打分，给出修改建议 |
| `store_knowledge` | `source_structures` | `knowledge_refs`(增量更新) | KnowledgeAgent | 从分析结果中提炼知识条目，入库 |

### 条件路由函数

| 路由名 | 判断逻辑 | 分支 |
|--------|---------|------|
| `route_after_gap_check` | `gap_report` 中是否有未填充的缺口 | 有→`fill_gaps`，无→`assemble_video` |
| `route_after_review` | `review_result.pass` 是否为 True，`iteration < max_iterations` | pass→`END`，fail且可迭代→`plan_scheme`，fail且超限→`END`(带警告) |
| `route_multi_video` | 是否还有未分析的爆款视频 | 有→`analyze_video`（循环），无→`ingest_materials` |

---

## 三、模块间依赖关系

```
models/ ◄────────── 所有模块都依赖，定义了全系统的数据语言
   ▲
   │
services/ ◄──────── agents/ 调用 services/ 完成实际工作
   ▲
   │
agents/ ◄────────── graph/nodes/ 调用 agents/ 的推理能力
   ▲
   │
graph/ ──────────── 顶层编排，定义流程、路由、状态管理
   ▲
   │
knowledge/ ◄─────── graph/nodes/ 中的 store_knowledge 节点调用
```

**依赖方向单向**：graph → agents → services → models，不允许反向依赖。

---

## 四、Phase 1 逻辑报告

### Phase 1 目标

**跑通核心闭环**：爆款视频输入 → 结构分析 → 方案生成 → 缺口识别 → 基础补全 → 视频合成 → 结果输出。

Phase 1 不实现：知识库沉淀、多版本生成、人机协同编辑、自然语言改片、Remotion 渲染（用 FFmpeg 替代）。

---

### Phase 1 范围内的节点

```
Phase 1 实现的节点（实线） vs 后续阶段（虚线）：

  START
    │
    ▼
  ┌─────────────────┐
  │  analyze_video  │  ✅ Phase 1
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ ingest_materials│  ✅ Phase 1
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐     ┌──────────────────┐
  │  plan_scheme    │····▶│ store_knowledge  │  ⬜ Phase 4
  └────────┬────────┘     └──────────────────┘
           │
           ▼
  ┌─────────────────┐
  │   check_gaps    │  ✅ Phase 1
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  fill_gaps      │  ✅ Phase 1（部分策略）
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ assemble_video  │  ✅ Phase 1（FFmpeg 简化版）
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ review_result   │  ✅ Phase 1
  └────────┬────────┘
           │
           ▼
          END
```

---

### Phase 1 各节点详细逻辑

#### 节点 1：analyze_video（爆款视频分析）

**触发条件**：State 中 `sample_videos` 非空

**执行逻辑**：

1. 从 `sample_videos` 取出一条视频路径
2. 调用 `VideoProcessor.get_video_info()` 获取基础信息（时长、分辨率、帧率）
3. 调用 `VideoProcessor.detect_scene_changes()` 做镜头切分，得到镜头列表（每个镜头的起止时间）
4. 对每个镜头，调用 `VideoProcessor.extract_frame()` 抽取中间帧关键帧
5. 调用 `VideoProcessor.extract_audio()` 抽取音频，再调用 `ASRService.transcribe()` 做语音转写
6. 将所有关键帧 + 转写文本一起交给 `AnalystAgent`，由 LLM 做综合分析
7. LLM 输出结构化的分析结果，包括：脚本段落结构、每个镜头的类型与描述、节奏曲线、包装风格、hook策略、整体结构模式
8. 将分析结果组装为 `VideoStructure` 对象，追加到 State 的 `source_structures` 列表

**AnalystAgent 的 LLM Prompt 设计要点**：
- 给定所有镜头的关键帧描述（由多模态LLM逐帧分析得到）
- 给定完整语音转写文本
- 要求输出固定 JSON Schema，包括 script_structure、shots_detail、rhythm_curve、packaging_analysis、hook_summary、structure_summary、key_techniques
- 对输出做 JSON 解析和校验

**多条爆款视频的处理**：
- 图中 `analyze_video` 节点通过条件路由 `route_multi_video` 实现循环
- 每次执行只分析一条视频，分析完后检查是否还有剩余
- 有剩余→再次进入 `analyze_video`，无剩余→进入下一节点
- 这样设计是因为视频分析较慢，分步执行可以更好地做进度展示和错误恢复

**Phase 1 的简化点**：
- ASR 暂用 Whisper 本地模型（不依赖云端服务）
- 多模态分析暂用纯文本 LLM + 关键帧描述（不调用多模态模型，节省成本）
- 包装分析仅做文字描述，不做参数提取（Phase 2 补上）

---

#### 节点 2：ingest_materials（素材入库）

**触发条件**：State 中 `user_materials` 非空

**执行逻辑**：

1. 遍历 `user_materials` 列表中的每个素材
2. 根据素材类型做不同处理：
   - **图片素材**：调用 LLM（多模态能力或纯文本+图片描述）分析图片内容，识别主体（商品/人物/场景）、风格、适合放置的视频位置
   - **视频素材**：抽取关键帧做分析，同时获取时长信息
   - **文本素材**：直接由 LLM 分析文本内容，提取关键信息和适用场景
3. 每个素材分析结果组装为 `MaterialItem` 对象，包含：ID、类型、路径、内容描述、标签、适合的镜头类型
4. 将所有 MaterialItem 汇总为 `MaterialInventory`，写入 State

**素材质量评估**：
- Phase 1 做基础评估：图片分辨率是否足够、视频时长是否满足、文本是否有实质内容
- 低质量素材标记警告，但不阻止流程

**素材与结构的初步匹配**：
- 在入库时就为每个素材标注"适合做哪些镜头"（hook / product_show / usage / cta 等）
- 这个标注在后续 `check_gaps` 节点会被用来判断能否匹配方案需求

---

#### 节点 3：plan_scheme（方案生成）

**触发条件**：`source_structures` 和 `material_inventory` 都已就绪

**执行逻辑**：

1. 从 `source_structures` 中选取主参考结构（Phase 1 默认取第一条，后续支持多条融合）
2. 用 LLM 对爆款结构做"可迁移模式提取"：
   - 分析哪些是结构骨架（必须保留），哪些是内容填充（可替换）
   - 提炼出通用的结构模板（如"3秒hook → 痛点引入 → 3个卖点递进 → 效果展示 → CTA"）
3. 结合新视频的主题、商品信息、用户偏好，将结构模板映射为新方案：
   - 为每个结构段落生成新的文案
   - 为每个分镜分配素材（从 MaterialInventory 中匹配）
   - 规划时间线（每个镜头的起止时间）
   - 设计包装方案（字幕位置、标题条、转场建议）
4. 输出 `VideoScheme` 对象，包含：脚本段落、分镜表、时间线草案、包装配置、节奏设计
5. 如果是迭代轮次（`review_result` 不为空），则 Prompt 中会额外包含审核意见，要求针对性修改

**方案生成的 Prompt 结构**：

```
System: 你是一位资深短视频编导

Context:
  - 爆款结构分析（结构模式、hook策略、节奏、关键技法）
  - 新视频的主题和商品信息
  - 可用素材清单（每个素材的描述和适合位置）
  - 用户偏好（平台、时长、风格）
  - [迭代时] 上一轮审核的修改意见

Task:
  基于爆款结构，为新内容创作一套完整的视频方案

Output (JSON):
  - script_blocks: 分段脚本
  - storyboard: 分镜表（含时间轴、素材分配、字幕、转场）
  - rhythm_design: 节奏设计
  - packaging_config: 包装方案
  - design_explanation: 迁移设计说明
```

**设计说明的重要性**：
- 方案中必须包含 `design_explanation` 字段
- 这个字段解释"为什么这样迁移"，是结果可解释性的关键
- 也是后续 `review_result` 节点评估的依据之一

---

#### 节点 4：check_gaps（缺口识别）

**触发条件**：`scheme` 已生成

**执行逻辑**：

1. 遍历 `scheme.storyboard` 中的每个分镜帧
2. 检查该帧的 `material_id` 是否能在 `material_inventory.items` 中找到对应素材
3. 如果找不到，或者找到了但素材质量/类型不匹配，标记为缺口
4. 对每个缺口生成 `MaterialGap` 记录：
   - 缺口位置（第几个分镜）
   - 需要的镜头类型
   - 该位置的目的
   - 优先级（1-5，hook 和商品展示优先级最高）
   - 建议的补全策略
5. 计算总体覆盖率：`已匹配分镜数 / 总分镜数`
6. 将缺口报告写入 State 的 `gap_report`

**缺口类型与补全策略映射**：

```
缺口类型              优先级   Phase 1 补全策略          后续可扩展策略
─────────────────────────────────────────────────────────────────────
开头 hook 镜头        5       文案补全(标题条+动态文字)   T2I/T2V 生成
商品特写镜头          4       现有素材多角度裁切          T2I 生成多视角
使用过程镜头          3       文案卡片+旁白描述          T2V 生成演示
对比镜头              3       Before/After 包装卡片       实拍素材+AI合成
结尾 CTA 镜头         2       文案+包装元素               TTS 配音
过渡/转场镜头         1       转场特效替代                T2V 生成
```

**Phase 1 的简化**：
- 缺口识别基于规则匹配（素材描述中是否包含关键词）
- 不做向量相似度检索（Phase 2 补上语义匹配）
- 优先级基于规则判断，不做 LLM 推理

---

#### 节点 5：fill_gaps（缺口补全）

**触发条件**：`gap_report` 中存在未填充的缺口

**执行逻辑**：

1. 按优先级排序缺口列表
2. 对每个缺口，根据 `suggested_strategy` 选择补全方式：

**Phase 1 支持的三种补全策略**：

**策略 A：文案/包装补全**
- 适用场景：缺失的画面可以用文字信息替代
- 执行：调用 LLM 生成替代文案，方案中标记该分镜为"包装卡片"类型
- 产出：更新 scheme 中对应分镜的 `visual_content` 和 `packaging_note`
- 示例：没有"使用过程"实拍 → 生成"3步使用方法"图文卡片

**策略 B：现有素材重组复用**
- 适用场景：用户提供的素材可以被裁切、变速、重复利用
- 执行：调用 `VideoProcessor` 对现有素材做裁切、缩放、变速处理
- 产出：生成新的素材文件，更新 MaterialInventory
- 示例：一张商品图 → 裁切出3个不同区域，产生3个"新"镜头

**策略 C：结构重排**
- 适用场景：调整段落顺序可以降低对缺失素材的依赖
- 执行：调用 LLM 重新规划脚本段落顺序
- 产出：更新 scheme 中的 `script_blocks` 和 `storyboard`
- 示例：缺少开头吸引镜头 → 把"效果展示"提前到开头，用视觉冲击替代 hook

**Phase 1 不实现的策略**（后续阶段）：
- AIGC 生成补全（T2I / T2V）— Phase 2
- TTS 配音补全 — Phase 2
- 完整的画面包装生成 — Phase 3

**补全后的更新**：
- 将新生成的素材追加到 `material_inventory`
- 更新 `gap_report` 中对应缺口的 `is_filled` 标记
- 如果补全改变了 scheme 的分镜结构，同步更新 `scheme`

---

#### 节点 6：assemble_video（视频合成）

**触发条件**：缺口补全完成（所有高优先级缺口已处理）

**执行逻辑**：

1. 从 `scheme` 中读取分镜表和时间线
2. 对分镜表做最终校验：确保每个分镜都有对应的素材
3. Phase 1 使用 FFmpeg 进行简化合成：
   - 将每个分镜对应的素材（图片/视频片段）按时长裁切
   - 按分镜顺序拼接
   - 添加字幕（通过 FFmpeg drawtext 滤镜）
   - 添加背景音乐（如果有的话）
   - 设置转场效果（Phase 1 仅支持简单的淡入淡出和硬切）
4. 输出最终视频文件，路径写入 State 的 `rendered_video_path`

**Phase 1 的简化**：
- 不使用 Remotion（需要 TypeScript 环境，Phase 3 接入）
- 用 FFmpeg 的 filter_complex 实现基础的画面拼接和字幕
- 包装效果仅限于字幕，标题条/贴纸等 Phase 2 补上
- 不支持复杂的动画效果

**合成命令的构建逻辑**：
```
对于每个分镜帧:
  if 素材是图片:
    -loop 1 -t {duration} -i {image_path}    # 图片转视频片段
  if 素材是视频:
    -ss {start} -t {duration} -i {video_path}  # 裁切视频片段
  
拼接: concat 滤镜
字幕: drawtext 滤镜，位置从 scheme.packaging_config 读取
转场: fade 滤镜（Phase 1）
编码: H.264, 竖屏 1080x1920
```

---

#### 节点 7：review_result（结果审核）

**触发条件**：视频合成完成

**执行逻辑**：

1. 收集审核所需信息：
   - 原始爆款的结构摘要（`source_structures` 中的 summary 字段）
   - 新生成的方案（`scheme`）
   - 合成视频路径（用于后续 Phase 做视觉审核）
2. 调用 `ReviewerAgent`，由 LLM 做多维度评估：
   - **结构保真度**：新方案是否保留了爆款的核心结构模式？
   - **内容适配度**：新内容与结构模板的适配程度
   - **节奏合理性**：节奏设计是否合理
   - **开头吸引力**：前3秒是否有足够的 hook
   - **缺口补全质量**：补全部分是否自然、不突兀
   - **整体完成度**：方案是否完整、可执行
3. 输出审核报告，包含：各维度分数、总分、是否通过（≥60分通过）、问题列表、修改建议
4. 写入 State 的 `review_result`

**Phase 1 的审核方式**：
- 纯 LLM 文本审核（基于方案描述，不看实际视频画面）
- Phase 2 接入视觉审核：截取合成视频的关键帧，用多模态LLM评估视觉效果

---

#### 条件路由逻辑

**路由 1：route_multi_video**（分析完一条后）
```
if 还有未分析的 sample_videos:
    → 回到 analyze_video（分析下一条）
else:
    → 进入 ingest_materials
```

**路由 2：route_after_gap_check**（缺口检查后）
```
if gap_report 中存在 priority >= 3 的未填充缺口:
    → 进入 fill_gaps
elif 存在 priority < 3 的未填充缺口:
    → 记录警告，进入 assemble_video（低优先级缺口可忽略）
else:
    → 直接进入 assemble_video
```

**路由 3：route_after_review**（审核后）
```
if review_result.pass == True:
    → END（成功完成）
elif iteration < max_iterations:
    → 回到 plan_scheme（带审核意见迭代）
else:
    → END（达到最大迭代次数，输出当前最优结果，附带警告）
```

---

### Phase 1 服务层实现要求

| 服务 | Phase 1 实现 | 依赖 |
|------|-------------|------|
| `LLMService` | 封装 Doubao API 调用，支持 JSON mode 输出 | 火山方舟 API |
| `VideoProcessor` | FFmpeg 封装：视频信息获取、镜头切分、关键帧抽取、音频抽取、简单合成 | FFmpeg 命令行 |
| `ASRService` | Whisper 本地模型封装 | openai-whisper 库 |
| `ImageGenService` | Phase 1 暂不实现，fill_gaps 中用结构重排和文案补全替代 | — |
| `VideoGenService` | Phase 1 暂不实现 | — |
| `TTSService` | Phase 1 暂不实现 | — |
| `RendererService` | Phase 1 暂不实现，合成由 FFmpeg 完成 | — |

---

### Phase 1 验收标准（对应课题评分）

| 课题任务 | Phase 1 覆盖 | 预期得分 |
|---------|-------------|---------|
| 任务1：样例视频输入与解析 | ✅ 支持单条/多条输入，展示基础信息 | 4-5分 |
| 任务2：结构拆解 | ✅ 脚本结构 + 节奏结构 + 包装结构（3类） | 8-10分 |
| 任务3：新内容与素材输入 | ✅ 支持图片/视频/文本输入，识别缺口 | 3分 |
| 任务4：结构迁移与结果生成 | ✅ 脚本 + 分镜 + 时间线草案 | 8-10分 |
| 任务5：素材缺口识别 | ✅ 识别结构槽位缺口 | 6-8分 |
| 任务6：素材缺口补全 | ✅ 文案补全 + 结构重排 + 素材复用（3种策略） | 9-12分 |
| 任务7：迁移过程可视化 | ⬜ 后续阶段（Phase 2） | 0分 |
| 任务8：结果可验证 | ⬜ 部分覆盖（有视频demo，缺对比展示） | 6分 |

**Phase 1 预估总分**：44-56分（100分制）

---

### Phase 1 执行顺序

```
Week 1: 基础设施搭建
  ├── 项目骨架初始化（LangGraph 项目结构）
  ├── models/ 全部数据模型定义
  ├── services/llm_service.py 封装 Doubao API
  ├── services/video_processor.py 封装 FFmpeg 基础操作
  └── services/asr_service.py 封装 Whisper

Week 2: 分析链路打通
  ├── agents/analyst.py 实现
  ├── graph/nodes/analyze_video.py 实现
  ├── 验证：输入一条视频 → 得到完整的 VideoStructure
  └── 调试 LLM Prompt，确保输出结构稳定

Week 3: 方案生成 + 缺口处理
  ├── agents/planner.py 实现
  ├── agents/material_manager.py 实现（入库 + 缺口识别）
  ├── graph/nodes/plan_scheme.py + check_gaps.py + fill_gaps.py 实现
  ├── 验证：输入爆款+素材 → 得到 VideoScheme + 缺口报告 + 补全结果
  └── 调试迁移 Prompt

Week 4: 合成 + 审核 + 闭环
  ├── graph/nodes/assemble_video.py 实现（FFmpeg 合成）
  ├── agents/reviewer.py 实现
  ├── graph/nodes/review_result.py 实现
  ├── graph/builder.py 组装完整图
  ├── main.py 端到端运行验证
  └── 准备演示 demo
```

---

以上是基于 LangGraph 的整体架构设计和 Phase 1 逻辑报告。核心思路是：

- **State 是全局数据总线**，所有节点通过读写 State 协作
- **每个节点对应一个明确的业务动作**，内部调用 Agent 完成 LLM 推理
- **条件路由控制流程分支**，支持循环分析、缺口跳过、迭代优化
- **Phase 1 聚焦核心闭环**，用最简工具链（FFmpeg + Whisper + LLM）跑通全流程

接下来要开始 Week 1 的基础设施搭建吗？