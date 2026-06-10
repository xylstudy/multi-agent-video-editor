# Pipeline 执行流程

> 从 `python main.py --topic "探店Vlog"` 到视频输出的完整调用链

---

## 一、启动链路

```
main.py:main()
  ↓ 解析 --topic, --samples, --materials, --output, --max-iterations
  ↓ 从 JSON 文件加载用户素材列表
  ↓
run_pipeline()
  ↓ 1. create_initial_state()     → 创建初始状态（33 个字段全默认值）
  ↓ 2. build_graph()               → 编译 LangGraph（7 个节点 + 条件边）
  ↓ 3. app.ainvoke(initial_state)  → 启动图执行，等待完成
  ↓
输出 result.json（含方案、视频路径、审核结果、日志）
```

---

## 二、核心概念：State 是共享黑板

所有节点读写同一个 `ViralEngineState` 对象，关键字段按阶段写入：

| 字段 | 谁写入 | 何时写入 |
|------|--------|---------|
| `source_structures` | Analyst | 分析完爆款视频后 |
| `material_inventory` | MaterialManager | 素材入库完成后 |
| `scheme` | Planner | 方案生成后 |
| `generated_materials` | Creative | 缺口补全后 |
| `rendered_video_path` | Assembler | 视频合成后 |
| `review_result` / `iteration` / `is_complete` | Reviewer | 审核完成后 |
| `current_task` | Supervisor | 每次决策后 |
| `logs` / `errors` | 所有人 | 随时追加 |

`create_initial_state()` 将所有字段初始化为空/None/False，只有 `phase: "init"`, `iteration: 0`。

---

## 三、LangGraph 图结构

```
         ┌──────────────┐
         │  supervisor  │  ←─ LLM 根据状态决定下一步
         └──────┬───────┘
                │
    ┌────┬──────┼──────┬──────┬──────┐
    ▼    ▼      ▼      ▼      ▼      ▼
 analyst material planner creative assembler reviewer
    │    │      │      │      │        │
    └────┴──────┴──────┴──────┴────────┘
                │
       is_complete? ──是──→ END
               否
                │
                ▼
           回到 supervisor
```

**路由规则**：
- Supervisor 出边：读取 `current_task.expert` → 映射到对应节点（`material_manager` → `material`）
- 专家出边：`is_complete=True` 则 END，否则回 Supervisor

---

## 四、完整执行流程（逐轮）

### 第 1 轮：supervisor

**入口 State**：`phase: "init"`, 所有数据为空, `iteration: 0`

**执行内容**：
1. 创建 `LLMTools` 客户端
2. 创建 `SupervisorAgent`，调用 `decide_next(state)`
3. `decide_next` 内部：读取当前 phase/structures/inventory/scheme/review 构建状态摘要 → 拼接专家清单列表 → 调用 LLM 获取 JSON 决策
4. LLM 返回 `{next_expert, task_description, reasoning}`
5. 将决策写入 `current_task`，追加一条 `logs`

**写入 State**：`current_task: {expert: "analyst", ...}`, `logs: [...]`

**路由**：`current_task.expert = "analyst"` → `analyst_node`

---

### 第 2 轮：analyst

**执行内容**（批量处理 sample_videos 中的每个视频）：

| 步骤 | 操作 | 技术实现 |
|------|------|---------|
| 1 | 获取视频基本信息 | OpenCV VideoCapture → width/height/fps/duration |
| 2 | 镜头切分 | 每秒取样 → 灰度帧差法(threshold=0.3) → 返回场景列表 |
| 3 | 提取音频并转写 | FFmpeg → 16kHz WAV → Whisper transcribe(lang=zh) |
| 4 | 逐镜头分析（循环） | 对每个镜头：OpenCV 抽中间帧 → Haar Cascade 人脸检测 → LLM 分析画面内容/技法/结构功能 |
| 5 | 全局结构分析 | LLM 综合分析所有镜头 + 文案 → 返回脚本段落/节奏曲线/包装风格/Hook策略/结构模式 |
| 6 | 组装 VideoStructure | 将 LLM 输出映射为 ShotInfo、RhythmPoint、PackagingStyle、VlogMeta 等结构化对象 |

**写入 State**：
- `source_structures: [VideoStructure]`
- `phase`: 如果还有更多视频 → `"analyst"`（继续分析下一个）；否则 → `"materials"`

**清空** `current_task: {}`（防止 Supervsior 路由再次读到"analyst"导致死循环）

**路由**：`is_complete=False` → 回到 `supervisor`

---

### 第 3 轮：supervisor

**入口 State 新增**：`source_structures: [VideoStructure...]`, `phase: "materials"`

**LLM 决策**：source_structures 不为空且 material_inventory 为空 → `next_expert: "material_manager"`

**路由**：`"material_manager"` → 映射到 `"material"` → `material_node`

---

### 第 4 轮：material

**执行内容**（遍历每个 user_material）：

| 素材类型 | 分析方式 | 输出 |
|---------|---------|------|
| IMAGE | LLM 分析画面内容/质量/适用性 + FaceTools 人脸检测 | MaterialItem |
| VIDEO | OpenCV 获取信息 → 每 2 秒抽帧 → LLM 分析内容段落/高光片段 | MaterialItem + highlight_clips |
| TEXT | LLM 提取关键信息/金句/情绪 | MaterialItem |

所有分析结果组装为 `MaterialInventory(items, gaps=[])`。

**写入 State**：`material_inventory: MaterialInventory`, `phase: "planning"`，清空 `current_task`

**路由**：回到 `supervisor`

---

### 第 5 轮：supervisor

**LLM 决策**：有爆款结构 + 有素材 + 没有方案 → `next_expert: "planner"`

---

### 第 6 轮：planner

**首次迭代（iteration=0）**：

| 步骤 | 操作 | 技术实现 |
|------|------|---------|
| 1 | 提取结构骨架 | 将 VideoStructure 序列化为 JSON → LLM 提取可迁移的骨架（structure_type、script_template、rhythm_template、hook_template） |
| 2 | 生成完整方案 | 骨架 JSON + 素材清单 JSON + 用户偏好 → LLM 生成完整 storyboard（每个分镜含 shot_type/duration/source_material_id/transition/emotion 等） |
| 3 | 组装 VideoScheme | 映射 shot_type 字符串 → ShotType 枚举，transition 字符串 → TransitionType 枚举，创建 StoryboardFrame 列表 |

**迭代模式（iteration>0）**：读取上一版方案 + 审核反馈 → LLM 基于反馈修改方案，保持骨架不变。

**写入 State**：`scheme: VideoScheme`, `phase: "gaps"`（首次）或 `"review"`（迭代），清空 `current_task`

---

### 第 7 轮：supervisor

**LLM 决策**：有方案 → 检查缺口 → `next_expert: "creative"`

---

### 第 8 轮：creative

**执行内容**：
1. 检查 `inventory.gaps`，如果都是已填充或无缺口 → 直接跳转到 `assemble` 阶段
2. 有缺口 → LLM 生成补全策略（素材复用/Ken Burns/文字卡/变速/结构重排/空镜头）
3. 将策略写回缺口对象的 `is_filled` 和 `fill_strategy` 字段

**写入 State**：`material_inventory`（gaps 已更新）, `generated_materials: fill_plan`, `phase: "assemble"`

---

### 第 9 轮：supervisor

**LLM 决策**：缺口已处理 → `next_expert: "assembler"`

---

### 第 10 轮：assembler

**执行内容**：
1. 构建 `material_id → path` 映射表
2. 遍历 scheme.storyboard，按分镜顺序收集对应素材路径
3. 调用 `VideoTools.concat_clips()` → FFmpeg concat demuxer 拼接所有片段
4. 调用 `shutil.copy2()` 拷贝到 `data/output/{title}.mp4`

**写入 State**：`rendered_video_path: "data/output/vlog.mp4"`, `phase: "review"`

---

### 第 11 轮：supervisor

**LLM 决策**：视频已合成，方案未审核 → `next_expert: "reviewer"`

---

### 第 12 轮：reviewer

**执行内容**：
1. LLM 8 维度审核（每个维度 0-10 分，带权重）：
   - 结构保真度(1.0) / Hook吸引力(1.5) / 内容适配度(1.0) / 节奏合理性(1.0)
   - 情绪连贯性(1.2) / 缺口补全质量(1.0) / 包装一致性(0.8) / 可执行性(0.5)
2. 计算加权总分，判断 pass/fail
3. 判断是否终止：

```python
is_complete = passed or iteration >= max_iterations(3) or hook_score < 4
```

**写入 State**：
- `review_result: {scores, total_score, pass, issues, suggestions}`
- `iteration: iteration + 1`
- `is_complete: True` 或 `False`
- `phase`: 完成 → `"complete"`；否则 → `"planning"`（回 planner 迭代）

---

### 第 13+ 轮：迭代循环（如果审核不通过）

```
supervisor → planner(迭代模式) → supervisor → reviewer
    ↑                                              │
    └────────── 不通过且未超迭代 ──────────────────┘
```

- **Planner 迭代**：读取上一版方案 JSON + 审核反馈 JSON → LLM 根据 `top_3_issues` 和 `suggestions` 修改方案
- **Reviewer 再次审核**：iteration +1，直到 `passed` 或 `iteration >= 3` 或 `hook_score < 4`

---

### 最终轮：结束

当 `is_complete=True`，Supervisor LLM 决策 `next_expert: "__end__"` → 路由到 END。

`app.ainvoke(initial_state)` 返回最终的 `final_state`。

---

## 五、数据流时间线

```
时间    Supervisor 决策          执行节点          State 变化
───    ───────────────         ──────────        ──────────────────
T1     → analyst               analyst_node       source_structures=[结构]
T2     → material_manager      material_node      material_inventory
T3     → planner               planner_node       scheme=方案
T4     → creative              creative_node      gaps=[已填充]
T5     → assembler             assembler_node     rendered_video_path=
T6     → reviewer              reviewer_node      review_result+iteration+1
                                                    ↓ 不通过且未超限
T7     → planner(迭代)          planner_node       scheme=新版方案
T8     → reviewer              reviewer_node      review_result+iteration+1
                                                    ↓ 通过或超限
T9     → __end__               —                  is_complete=True
```

---

## 六、LLM 调用清单

| 节点 | 调用次数 | 用途 |
|------|---------|------|
| supervisor | 6~10 次 | 每次回到 supervisor 调一次 LLM 决策 |
| analyst | 2 + N 次 | 1 次信息决策 + N 次镜头分析 + 1 次结构分析 |
| material_manager | 1~4 次 | 每个素材调 1 次 + 1 次缺口检查 |
| planner | 2~3 次 | 骨架提取 + 方案生成 +（可选）迭代 |
| creative | 1~2 次 | 补全策略 +（可选）文字卡生成 |
| reviewer | 1 次 | 8 维度审核 |
| **总计** | **15~30 次** | 取决于镜头数和迭代轮次 |

---

## 七、关键设计说明

### 7.1 为什么每个专家要清空 current_task

Supervisor 的路由读取 `current_task.expert` 决定下一步。如果专家不清空，执行完后路由会再次读到相同的 expert 值，导致**无限循环调用同一个专家**。

所以每个专家节点返回时都设置 `current_task: {}`。

### 7.2 LangGraph 如何形成循环

条件边形成循环：`supervisor → expert → supervisor → expert → ...`

每次专家执行完都回到 supervisor（除非 `is_complete=True`），Supervisor 再调用 LLM 看最新状态决定下一步。

### 7.3 审核迭代的终止条件

```python
is_complete = passed_review or iteration >= max_iter(3) or hook_score < 4
```

- `hook_score < 4`：Hook 吸引力太低，继续迭代也没意义
- `iteration >= max_iter`：已达上限，接受当前方案
- `passed_review`：审核通过

### 7.4 Mock 模式（无 API Key）

如果没有配置 `DOUBAO_API_KEY`，`LLMTools.chat()` 返回固定 mock JSON，其格式是 `{note, message}`，不是 Supervisor 期望的 `{next_expert, task_description}` 格式。`parse_json()` 解析后 key 不匹配 → `next_expert` 取不到值 → 默认 `"__end__"` → 流程直接结束。
