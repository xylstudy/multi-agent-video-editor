# Reference-guided 结构迁移：Gene × Skill 架构说明

> 一句话：**Gene 决定「迁移什么」，Skill 决定「怎么迁移好」。**
> 本次升级把系统从「复制爆款内容」升级为「迁移爆款结构」。

## 1. 设计目标

保留既有的 `参考视频 → Analyst → 结构/Gene JSON → Planner` 链路并强化它，同时新增一层
跨任务复用的剪辑 Skill，但严格保证 Skill 不覆盖 Gene 的核心结构。

## 2. Gene 与 Skill 的边界

| 维度 | Reference Gene（结构基因） | Editing Skill（剪辑技能） |
|---|---|---|
| 作用域 | 当前参考视频**专属** | 跨任务**长期复用** |
| 决定什么 | 迁移**什么结构**（镜头功能 / 节奏 / 情绪骨架） | **怎么剪好**（手法 / 替代策略） |
| 约束性质 | 硬约束为主 | 软策略为主 |
| 可否被覆盖 | 仅用户显式要求可覆盖 | 可被 Gene 硬约束覆盖 |

**优先级（贯穿 Planner / Reviewer）**：

```
用户显式要求  >  Reference Gene 硬约束  >  Editing Skill 策略  >  模型自由发挥
```

## 3. 关键文件

| 文件 | 变更 | 说明 |
|---|---|---|
| `models/gene.py` | 新增 | `ConstraintKind` / `GeneConstraint` / `ShotGene` / `StructureGene` + 纯函数 `build_gene()` |
| `models/video_structure.py` | 修改 | `VideoStructure` 增加 `gene: Optional[StructureGene]` |
| `skills/router.py` | 新增 | `SkillRouter` 确定性路由 + `route_by_llm` 语义兜底 |
| `skills/video-editing/SKILL.md` + `references/*.md` | 新增 | 7 个 reference：hook/rhythm/transition/emotion/material-matching/structure-adaptation/subtitle |
| `models/scheme.py` | 修改 | `StoryboardFrame` 增加 `structure_function/gene_shot_index/skill_refs/adaptation`；`VideoScheme` 增加 `gene_refs/skill_refs_used/adaptation_log` |
| `agents/analyst.py` | 修改 | 调用 `build_gene()`，把 Gene 挂到 `VideoStructure.gene` |
| `prompts/planner_prompts.py` | 修改 | Gene 段 + Skill 段 + 决策优先级 + Structure Transfer 指引 |
| `agents/planner.py` | 修改 | 消费 `gene_json` + `skill_context`，映射新溯源字段 |
| `prompts/reviewer_prompts.py` | 重写 | Fidelity（A1-A6）+ Quality（B1-B6）双维度 + `feedback_type` |
| `agents/reviewer.py` | 修改 | 双维度 system prompt + `gene_json` 入参 |
| `graph/state.py` | 修改 | 增加 `source_genes` / `skill_refs` |
| `graph/builder.py` | 修改 | 收集 Gene + Skill，注入 Planner/Reviewer，记录溯源 |

## 4. Gene 结构（表达「功能」而非「内容」）

`ShotGene` 关键字段：

- `function`：语义功能（`hook / establishing / daily_moment / climax / closing / transition / info`）
- `semantic_role` / `rhythm_role` / `emotion_role` / `relation_to_previous`
- `visual_requirement`：功能性画面要求（「宽景/地标/环境交代」），而非「拍同一个物体」
- `duration_ratio` / `importance`（`critical/high/medium/low`）
- `hard_constraints` / `soft_preferences`

`StructureGene` 提供 `critical_shots()` / `hard_constraint_text()` / `soft_preference_text()`。

`build_gene(shot_analyses, structure_analysis, ...)` 是纯函数，把 Analyst 的逐镜头分析 +
全局结构分析映射为基因：`hook→critical`、`climax/establishing/closing→high`，并写入
`保持高潮位置约为全片 N%` 等硬约束。

## 5. 渐进式披露（按需加载 Skill）

- 目录：`SKILL.md` 只放「定位 / 使用时机 / 路由规则 / 优先级」，真实知识在 `references/*.md`
  （每个含 适用条件 / 不适用条件 / 推荐策略 / 例子）。
- 路由：`route_for_stage`（规划阶段 → reference）、`route_for_shot`（镜头功能 → reference）、
  `route_for_gene`（汇总整条 Gene 所需 reference，恒含 `structure-adaptation`，含 `establishing`
  时强制 `material-matching`）。
- 兜底：`route_by_llm` 仅在确定性规则覆盖不到时调用。
- **未引入 RAG / 向量库。**

## 6. Planner 如何融合

1. `gene_json` 作为核心约束单独成段；
2. `skill_context` 按需注入（只注入本次加载的 reference）；
3. 素材清单 + 音频特征 + 系统能力手册；
4. 决策优先级 + Structure Transfer 指引。

产出 `VideoScheme`，逐镜带 `structure_function / gene_shot_index / skill_refs / adaptation`，
方案级带 `gene_refs / skill_refs_used / adaptation_log`，形成
`Gene → Material → Skill → Adaptation` 的完整溯源链。

## 7. Reviewer 如何评估结构迁移

- **A 组 Fidelity**（迁移得「像不像」）：Hook 结构、镜头/时长关系、节奏曲线、情绪弧线、
  高潮/Ending 位置、核心镜头功能。
- **B 组 Quality**（在当前素材上「剪得好不好」）：素材匹配、转场、节奏自然度、情绪连贯、
  字幕包装、素材覆盖。
- 输出 `feedback_type ∈ {fidelity, quality, mixed}`：fidelity 回 Planner 恢复 Gene，
  quality 在不破坏 Gene 的前提下优化剪辑。

## 8. 验收用例对应

| Case | 验证点 |
|---|---|
| 1 | Gene 始终存在并流入 Planner（`build_gene` + `VideoStructure.gene` + prompt Gene 段） |
| 2 | 按需加载 Skill（规划 hook 只加载 `hook.md`） |
| 3 | 功能级素材迁移（`establishing` 无航拍 → 宽景/地标替代） |
| 4 | Skill 不能覆盖 Gene（优先级 + `route_for_gene` 恒含 `structure-adaptation`） |
| 5 | VideoScheme 可溯源（`knowledge_refs` 沿用 + 新溯源字段） |
| 6 | Reviewer 区分 Fidelity vs Quality |

## 9. 向后兼容

- LangGraph / `ViralEngineState` / Analyst / MaterialManager / Planner / VideoScheme /
  Renderer / Assembler / Reviewer / Knowledge / Trace 均沿用，只做增量集成。
- `_generate_scheme` / `_review_scheme` 等只追加可选参数，旧脚本
  （`run_scheme_generation.py` / `run_pipeline_e2e.py` / `run_beijing_pipeline.py`）仍可用。
- `knowledge_refs` 字段保留复用，未重设计。
