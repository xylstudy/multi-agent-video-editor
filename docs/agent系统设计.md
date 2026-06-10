# Agent 编排流程与职责工具全景

---

## 一、Agent 编排总览

整个系统有 **7 个 Agent**，由 LangGraph 的 State 图驱动协作。不存在一个"中央大脑"在指挥，而是**状态流转驱动节点执行**——上一个节点写入 State 的产出，决定了下一个节点该由谁来接棒。

```
编排流程全景（按执行顺序）：

  ┌─────────────────────────────────────────────────────────────────┐
  │                        Supervisor Agent                         │
  │              （LangGraph State 图本身即编排者）                    │
  │     职责：不做具体业务，只负责状态流转和路由决策                     │
  └────────┬────────────────────────────────────────────────────────┘
           │ 启动流程
           ▼
  ┌────────────────┐
  │ ① Analyst      │◄─── 可循环（多条爆款视频逐条分析）
  │    Agent       │
  └───────┬────────┘
          │ 写入 source_structures
          ▼
  ┌────────────────┐
  │ ② Material     │◄─── 素材入库阶段
  │    Manager     │
  └───────┬────────┘
          │ 写入 material_inventory
          ▼
  ┌────────────────┐     ┌────────────────┐
  │ ③ Knowledge    │     │ ④ Planner      │◄── 可循环（审核迭代时回跳）
  │    Agent       │     │    Agent       │
  └───────┬────────┘     └───────┬────────┘
          │ 知识沉淀               │ 写入 scheme
          ▼                       ▼
                            ┌────────────────┐
                            │ ② Material     │◄── 第二次调用：缺口识别
                            │    Manager     │
                            └───────┬────────┘
                                    │
                               有缺口？
                              Yes │  No
                            ┌─────┘
                            ▼
                      ┌────────────────┐
                      │ ⑤ Creative     │
                      │    Agent       │
                      └───────┬────────┘
                              │ 补全素材
                              ▼
                      ┌────────────────┐
                      │ ⑥ Assembler    │
                      │    Agent       │
                      └───────┬────────┘
                              │ 输出视频
                              ▼
                      ┌────────────────┐
                      │ ⑦ Reviewer     │
                      │    Agent       │
                      └───────┬────────┘
                              │
                         pass? │
                      No ─────┤───── Yes
                      │              │
                 回到 ④ Planner      ▼
                                   END
```

---

## 二、每个 Agent 的详细定义

### ① Analyst Agent（分析师）

**一句话职责**：把一条爆款视频"读透"，输出结构化的分析报告。

**执行时机**：流程开始阶段，每条爆款视频调用一次。

**具体做什么**：
1. 获取视频基础信息（时长、分辨率、帧率）
2. 做镜头切分——把一条连续的视频切成若干个镜头片段
3. 对每个镜头抽取关键帧（取中间时间点的一帧作为代表）
4. 对每个关键帧做画面内容分析（画面里有什么、什么构图、什么情绪）
5. 对整条视频做语音转写（旁白/台词转成文字）
6. 综合以上所有信息，用 LLM 做结构化推理：
   - 脚本分成了几段，每段的目的和文案是什么
   - 镜头切换的节奏是怎样的，哪里快哪里慢
   - 高潮/转折点在哪个位置
   - 字幕是什么样式，用了什么包装元素
   - 开头的 hook 策略是什么
   - 整体结构模式属于哪种类型（痛点切入型？效果展示型？对比型？）
   - 用了哪些关键剪辑技法
7. 将推理结果组装为 `VideoStructure` 对象

**输入**：
- 一条视频文件路径

**输出**：
- 一个 `VideoStructure` 对象，包含完整的结构化分析结果

**调用的工具**：

| 工具 | 用途 | 具体操作 |
|------|------|---------|
| `VideoProcessor.get_video_info()` | 获取视频元信息 | 调用 FFmpeg 的 ffprobe，获取时长/分辨率/帧率/编码格式 |
| `VideoProcessor.detect_scene_changes()` | 镜头切分 | 调用 FFmpeg 的 scene detect filter，根据画面变化阈值切分 |
| `VideoProcessor.extract_frame()` | 抽取关键帧 | 调用 FFmpeg，在指定时间点截取一帧图片 |
| `VideoProcessor.extract_audio()` | 抽取音频轨 | 调用 FFmpeg，从视频中分离出 WAV 音频 |
| `ASRService.transcribe()` | 语音转文字 | 调用 Whisper，将音频转为带时间戳的文本 |
| `LLMService.chat()` | 画面内容分析 | 对每张关键帧，用 LLM 描述画面内容（Phase 1 用文本描述代替多模态） |
| `LLMService.chat()` | 综合结构推理 | 将所有信息汇总后，由 LLM 做结构化分析，输出 JSON |

**关键设计点**：
- 这个 Agent 是整个系统的**数据源头**，分析质量直接影响后续所有环节
- 对 LLM 的 Prompt 需要精心设计，要求输出固定 JSON Schema，便于下游解析
- 多条爆款视频时，这个 Agent 会被多次调用，每次处理一条

---

### ② Material Manager Agent（素材管家）

**一句话职责**：管理用户素材的全生命周期——入库分析、缺口识别、补全后的素材更新。

**执行时机**：整个流程中会被调用**两次**，做不同的事。

#### 第一次调用：素材入库（ingest）

**具体做什么**：
1. 遍历用户上传的所有素材（图片、视频、文本）
2. 对每个素材做内容理解和标注：
   - 图片：识别画面中的主体（商品？人物？场景？）、画面风格、画质评估
   - 视频：抽取关键帧分析 + 获取时长信息
   - 文本：提取关键信息（商品名、卖点、价格等）
3. 为每个素材打标签：适合用在视频的什么位置（hook / 产品展示 / 使用过程 / CTA 等）
4. 评估素材质量：分辨率是否够、时长是否足、内容是否有实质
5. 汇总为 `MaterialInventory`，其中每个素材有 `MaterialItem` 记录

**输入**：
- `user_materials` 列表（用户上传的所有素材）

**输出**：
- `MaterialInventory` 对象（素材清单）

#### 第二次调用：缺口识别（find_gaps）

**具体做什么**：
1. 拿到 `Planner Agent` 生成的 `VideoScheme`（分镜表）
2. 遍历分镜表中的每一帧，检查：
   - 这一帧需要什么类型的素材？（从 `purpose` / `shot_type` 推断）
   - 用户提供的素材中有没有匹配的？（从素材的 `suitable_for` 标签匹配）
3. 如果匹配不上，就记录为一个缺口（`MaterialGap`），包含：
   - 缺口在第几个分镜
   - 需要什么类型的镜头
   - 优先级有多高（hook 最高，CTA 次之，过渡最低）
   - 建议用什么策略补全
4. 计算总体素材覆盖率

**输入**：
- `scheme`（Planner 产出的视频方案）
- `material_inventory.items`（可用素材列表）

**输出**：
- 更新后的 `MaterialInventory`（增加了 `gaps` 列表）

**调用的工具**：

| 工具 | 用途 | 使用场景 |
|------|------|---------|
| `LLMService.chat()` | 素材内容理解 | 对图片/视频/文本做内容分析、打标签 |
| `VideoProcessor.extract_frame()` | 视频关键帧抽取 | 视频素材入库时抽取关键帧供 LLM 分析 |
| `VideoProcessor.get_video_info()` | 视频信息获取 | 获取用户上传视频的时长等基础信息 |

**关键设计点**：
- 这个 Agent 被复用了两次，用 `action` 参数区分不同任务
- 缺口识别阶段不需要 LLM 推理，用规则匹配就够了（Phase 1 方案）
- 优先级算法是关键——hook 和商品展示的缺口必须补，过渡镜头可以忽略

---

### ③ Knowledge Agent（知识官）

**一句话职责**：从爆款分析结果中提炼可复用的知识，沉淀到知识库，并在需要时检索相关知识供 Planner 参考。

**执行时机**：与 Planner Agent 并行执行（或在 Planner 之前执行）。Phase 1 暂不实现，Phase 4 补上。

**具体做什么**：

**提炼入库（extract）**：
1. 拿到 `Analyst Agent` 输出的 `VideoStructure`
2. 对其中的结构模式、编辑技法、包装风格做抽象和归类
3. 与知识库中已有的条目做关联：这条视频的 hook 手法和库里哪条类似？
4. 如果发现了新的模式或规律，生成新的知识条目
5. 对知识做向量化（embedding），存入向量数据库

**检索参考（retrieve）**：
1. 当有新的创作需求时，根据用户的需求描述做语义检索
2. 从知识库中找出最相关的结构模板、编辑手法、类似案例
3. 将检索结果整理为参考信息，传给 Planner Agent

**输入**：
- 提炼入库时：`source_structures`
- 检索参考时：`target_topic` + `target_info`

**输出**：
- 提炼入库时：更新知识库
- 检索参考时：`knowledge_refs`（相关知识条目列表）

**调用的工具**：

| 工具 | 用途 | 使用场景 |
|------|------|---------|
| `LLMService.chat()` | 知识抽象推理 | 从分析结果中提炼规律和模式 |
| `LLMService.chat()` | 知识关联 | 新知识与已有知识的关联匹配 |
| `KnowledgeStore.add()` | 知识入库 | 存储新的知识条目 |
| `KnowledgeStore.search()` | 语义检索 | 根据需求检索相关知识 |
| `EmbeddingService.embed()` | 向量化 | 将知识条目转为向量用于检索 |

---

### ④ Planner Agent（编导）

**一句话职责**：基于爆款结构 + 新内容 + 素材情况，制定完整的视频迁移方案。这是整个系统中**最核心**的 Agent。

**执行时机**：素材入库之后、缺口识别之前。如果审核不通过，会被再次调用进行迭代优化。

**具体做什么**：

**第一阶段：理解爆款结构**
1. 读取 `Analyst Agent` 输出的 `VideoStructure`
2. 用 LLM 提炼出"可迁移的结构模板"：
   - 哪些是结构骨架（必须保留的框架）
   - 哪些是内容填充（可以根据新内容替换的部分）
   - 这个结构为什么有效（背后的创作逻辑）
3. 如果有 `Knowledge Agent` 提供的参考知识，一并纳入考量

**第二阶段：结构迁移映射**
1. 拿到新视频的主题、商品信息、用户偏好
2. 将爆款结构模板中的每个段落，映射到新内容上：
   - 爆款的 hook 是"痛点提问" → 新视频的 hook 也用类似策略，但换成新商品的痛点
   - 爆款中间有3个卖点递进 → 新视频也保持3个卖点递进，用新商品的卖点填充
3. 为每个分镜分配素材：从 `MaterialInventory` 中挑选最合适的素材

**第三阶段：方案输出**
1. 生成完整的脚本（每段文案 + 时长建议）
2. 生成分镜表（每个镜头的画面描述、素材来源、字幕、转场）
3. 规划节奏（每个时间点的节奏强度）
4. 设计包装方案（字幕样式、标题条、转场、强调元素）
5. 写设计说明（为什么这样迁移，哪些保留了爆款结构，哪些做了适配）

**第四阶段：迭代优化（审核不通过时）**
1. 读取 `Reviewer Agent` 的审核意见
2. 针对每个问题做修改
3. 重新输出方案

**输入**：
- `source_structures`（爆款分析结果）
- `target_topic` + `target_info`（新视频需求）
- `material_inventory`（可用素材）
- `knowledge_refs`（知识库参考，Phase 1 为空）
- `review_result`（迭代时的审核意见，首轮为空）
- `user_preferences`（用户偏好）

**输出**：
- `VideoScheme` 对象（完整视频方案）

**调用的工具**：

| 工具 | 用途 | 使用场景 |
|------|------|---------|
| `LLMService.chat()` | 结构模式提取 | 从爆款分析中提炼可迁移的结构模板 |
| `LLMService.chat()` | 脚本生成 | 为新内容生成分段脚本文案 |
| `LLMService.chat()` | 分镜规划 | 生成分镜表、时间线、素材分配 |
| `LLMService.chat()` | 包装设计 | 设计字幕样式、标题条、转场方案 |
| `LLMService.chat()` | 迭代修改 | 根据审核意见调整方案 |

**关键设计点**：
- Planner 是 LLM 调用最密集的 Agent，Prompt 工程是成败关键
- 需要在 Prompt 中给 LLM 足够的上下文（爆款结构 + 新内容 + 素材情况），但不能太长超出上下文窗口
- 迭代时需要把上一版方案和审核意见都给到 LLM，让它知道改什么、怎么改
- 输出必须是严格的 JSON Schema，否则下游无法解析

---

### ⑤ Creative Agent（创作师）

**一句话职责**：针对素材缺口，生成缺失的素材内容。

**执行时机**：缺口识别之后，只有当存在高优先级缺口时才被调用。

**具体做什么**：
1. 读取 `Material Manager` 输出的缺口列表
2. 按优先级从高到低处理每个缺口
3. 根据缺口类型和建议策略，选择不同的生成方式：

| 缺口场景 | Phase 1 策略 | 后续策略 |
|---------|-------------|---------|
| 缺少开头 hook 画面 | LLM 生成"标题卡"文案 + 包装方案 | T2I 生成开头画面 |
| 缺少商品特写 | 对现有商品图做裁切放大，生成多个"新"视角 | T2I 生成多角度商品图 |
| 缺少使用过程 | LLM 生成"使用步骤"文案卡片 | T2V 生成使用演示视频 |
| 缺少对比画面 | LLM 生成 Before/After 对比文案 | T2I + 合成 |
| 缺少旁白配音 | LLM 写旁白文案 | TTS 生成配音 |
| 缺少结尾 CTA | LLM 生成行动号召文案 + 包装方案 | TTS + T2I |

4. 将生成的素材存入文件系统，创建对应的 `MaterialItem` 记录
5. 更新 `MaterialInventory`

**输入**：
- `gap_report`（缺口列表）
- `target_info`（商品信息，用于生成内容）
- 样例结构中的风格指引（保持风格一致）

**输出**：
- `generated_materials`（生成的素材列表）
- 更新后的 `material_inventory`

**调用的工具**：

| 工具 | 用途 | Phase 1 是否可用 |
|------|------|-----------------|
| `LLMService.chat()` | 生成文案（标题、卖点卡片、旁白、CTA） | ✅ 可用 |
| `LLMService.chat()` | 生成 T2I prompt（为后续图片生成做准备） | ✅ 生成 prompt |
| `ImageGenService.generate()` | T2I 生成图片 | ⬜ Phase 2 接入 |
| `VideoGenService.generate()` | T2V 生成视频片段 | ⬜ Phase 2 接入 |
| `TTSService.synthesize()` | TTS 生成配音 | ⬜ Phase 2 接入 |
| `VideoProcessor.crop()` | 现有素材裁切复用 | ✅ 可用 |
| `VideoProcessor.resize()` | 素材缩放 | ✅ 可用 |
| `VideoProcessor.speed_change()` | 素材变速 | ✅ 可用 |

---

### ⑥ Assembler Agent（合成师）

**一句话职责**：把方案和素材"组装"成最终视频。

**执行时机**：缺口补全完成后、审核之前。

**具体做什么**：
1. 从 `VideoScheme` 中读取完整的分镜表和时间线
2. 做最终校验：每个分镜是否都有对应素材
3. 按时间线依次处理每个分镜：
   - 图片素材 → 转为指定时长的视频片段（加缩放/平移动效让画面不呆板）
   - 视频素材 → 按起止时间裁切
   - 添加字幕（从分镜的 `subtitle_text` 读取）
   - 设置转场效果
4. 按分镜顺序拼接所有片段
5. 叠加音频轨（BGM + 旁白 + 原始音频混合）
6. 编码输出为 MP4

**输入**：
- `scheme`（视频方案）
- `material_inventory`（所有可用素材，含 AI 生成的）

**输出**：
- `rendered_video_path`（视频文件路径）

**调用的工具**：

| 工具 | 用途 | Phase 1 实现方式 |
|------|------|-----------------|
| `FFmpeg` | 图片转视频 | `-loop 1 -t {duration}` 静态图转视频 |
| `FFmpeg` | 视频裁切 | `-ss {start} -t {duration}` 截取片段 |
| `FFmpeg` | 字幕叠加 | `drawtext` 滤镜 |
| `FFmpeg` | 转场效果 | `fade` 滤镜（Phase 1 仅支持淡入淡出） |
| `FFmpeg` | 片段拼接 | `concat` 滤镜 |
| `FFmpeg` | 音频混合 | `amix` 滤镜 |
| `FFmpeg` | 编码输出 | H.264 编码 |
| `RendererService` | Remotion 渲染 | ⬜ Phase 3 接入（替代 FFmpeg，支持复杂动画） |

**关键设计点**：
- Phase 1 用 FFmpeg 全链路搞定，虽然效果有限但能跑通
- Phase 3 切换到 Remotion 后，方案 JSON 直接映射为 React 组件的 props，渲染能力质的飞跃
- 这个 Agent 不需要 LLM，纯粹是工程逻辑

---

### ⑦ Reviewer Agent（审核员）

**一句话职责**：评估生成结果的质量，决定通过还是打回重做。

**执行时机**：视频合成完成后。

**具体做什么**：
1. 收集评估所需信息：
   - 原始爆款的结构摘要（hook策略、结构模式、关键技法）
   - 新生成的方案详情（脚本、分镜、包装）
   - 合成视频的路径（Phase 2 开始做视觉审核）
2. 用 LLM 做多维度打分：

| 评估维度 | 满分 | 评估标准 |
|---------|------|---------|
| 结构保真度 | 10 | 新方案是否保留了爆款的核心结构骨架 |
| 内容适配度 | 10 | 新内容与结构模板是否适配（不是生搬硬套） |
| 节奏合理性 | 10 | 前紧后松？全程快切？节奏是否有变化 |
| 开头吸引力 | 10 | 前3秒是否有足够的 hook |
| 缺口补全质量 | 10 | 补全部分是否自然，不突兀 |
| 整体完成度 | 10 | 方案是否完整、可执行 |

3. 计算加权总分
4. 总分 ≥ 60 分 → 通过，输出最终结果
5. 总分 < 60 分 → 不通过，输出具体问题列表和修改建议
6. 检查迭代次数，如果已达到最大迭代次数，即使不通过也强制输出当前最优结果

**输入**：
- `scheme`（视频方案）
- `source_structures`（原始爆款分析）
- `rendered_video_path`（合成视频路径，Phase 2 使用）

**输出**：
- `review_result`：包含各维度分数、总分、是否通过、问题列表、修改建议

**调用的工具**：

| 工具 | 用途 | 使用场景 |
|------|------|---------|
| `LLMService.chat()` | 多维度评估打分 | 综合所有信息做评估 |
| `LLMService.chat()` | 生成修改建议 | 不通过时输出具体的改进方向 |
| `VideoProcessor.extract_frame()` | 视频关键帧抽取 | Phase 2 接入，抽取合成视频关键帧给 LLM 做视觉审核 |

---

## 三、Agent 间的数据流关系

```
Agent 之间不直接通信，全部通过 State 间接协作：

  Analyst ──写入──▶ State.source_structures ──被读取──▶ Planner
                                                 ──被读取──▶ Knowledge
                                                 ──被读取──▶ Reviewer

  Material Manager ──写入──▶ State.material_inventory ──被读取──▶ Planner
  (第一次: 入库)                                    ──被读取──▶ Material Manager
                                                    (第二次: 缺口识别)

  Knowledge ──写入──▶ State.knowledge_refs ──被读取──▶ Planner

  Planner ──写入──▶ State.scheme ──被读取──▶ Material Manager (缺口识别)
                                  ──被读取──▶ Assembler
                                  ──被读取──▶ Reviewer
                                  ──被读取──▶ Planner 自身 (迭代时读取旧方案)

  Material Manager ──写入──▶ State.gap_report ──被读取──▶ Creative
  (第二次: 缺口识别)

  Creative ──写入──▶ State.generated_materials ──被读取──▶ Assembler
             ──写入──▶ State.material_inventory(更新) ──被读取──▶ Assembler

  Assembler ──写入──▶ State.rendered_video_path ──被读取──▶ Reviewer

  Reviewer ──写入──▶ State.review_result ──被读取──▶ 路由函数 (决定下一步)
                                       ──被读取──▶ Planner (迭代时作为反馈)
```

---

## 四、每个 Agent 的工具依赖汇总

```
                    LLM   FFmpeg  Whisper  T2I   T2V   TTS   Remotion  知识库
                    ────  ──────  ───────  ───   ───   ───   ────────  ─────
Analyst              ✅     ✅      ✅      ·     ·     ·      ·        ·
Material Manager     ✅     ✅      ·       ·     ·     ·      ·        ·
Knowledge            ✅     ·       ·       ·     ·     ·      ·        ✅
Planner              ✅     ·       ·       ·     ·     ·      ·        ·(读)
Creative             ✅     ✅(裁切)  ·     ⬜P2  ⬜P2  ⬜P2     ·        ·
Assembler            ·      ✅      ·       ·     ·     ·     ⬜P3      ·
Reviewer             ✅     ⬜P2     ·       ·     ·     ·      ·        ·
```

- **LLM** 是使用最广的工具，除了 Assembler 之外每个 Agent 都需要
- **FFmpeg** 是最核心的工程工具，贯穿分析、处理、合成全链路
- **T2I / T2V / TTS** 在 Phase 2 由 Creative Agent 调用
- **Remotion** 在 Phase 3 由 Assembler 调用，替代 FFmpeg 的简化合成
- **知识库** 在 Phase 4 由 Knowledge Agent 负责读写，Planner 只读

---

需要进一步细化某个 Agent 的内部实现逻辑吗？还是开始制定具体的开发计划？