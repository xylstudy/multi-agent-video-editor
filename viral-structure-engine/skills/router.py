"""Skill 路由 — 渐进式披露的剪辑知识加载器。

职责边界（与 Gene 严格区分）：
  Gene  当前参考视频专属，决定"迁移什么结构"，硬约束为主。
  Skill 跨任务长期复用，帮助 Planner 判断"在用户素材条件下怎么把结构剪好"，软策略为主。

优先级：用户显式要求 > Reference Gene > Editing Skill > 模型自由发挥。

本模块提供：
  - 确定性场景触发（stage / shot function → reference 文件），无需 LLM，可单测。
  - LLM 语义兜底（route_by_llm），仅在确定性规则覆盖不到时调用。
  - references/*.md 的按需加载。

暂不引入 RAG / 向量库 / 复杂检索。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

SKILLS_ROOT = Path(__file__).resolve().parent


@dataclass
class SkillReference:
    """一个已加载的 reference 文件。"""
    name: str
    content: str

    def to_dict(self) -> dict:
        return {"name": self.name, "content": self.content}


@dataclass
class SkillPlan:
    """一次规划任务要加载哪些 reference，以及为什么。"""
    skill: str = "video-editing"
    references: list[str] = field(default_factory=list)
    triggers: dict = field(default_factory=dict)  # ref name -> 触发原因

    def to_dict(self) -> dict:
        return {"skill": self.skill, "references": self.references, "triggers": self.triggers}


class SkillRouter:
    """确定性场景路由 + reference 按需加载。"""

    # 规划阶段 → reference 文件名（不含 .md）
    STAGE_TO_REFS: dict[str, list[str]] = {
        "hook": ["hook"],
        "opening": ["hook"],
        "rhythm": ["rhythm"],
        "pacing": ["rhythm"],
        "transition": ["transition"],
        "emotion": ["emotion"],
        "material_matching": ["material-matching"],
        "material": ["material-matching"],
        "structure_adaptation": ["structure-adaptation"],
        "adaptation": ["structure-adaptation"],
        "subtitle": ["subtitle"],
        "packaging": ["subtitle"],
    }

    # 镜头功能 → reference（结构功能触发）
    SHOT_FUNCTION_TO_REFS: dict[str, list[str]] = {
        "hook": ["hook"],
        "establishing": ["material-matching", "structure-adaptation"],
        "scene_establish": ["material-matching", "structure-adaptation"],
        "climax": ["emotion", "rhythm"],
        "emotion_peak": ["emotion", "rhythm"],
        "transition": ["transition"],
        "closing": ["emotion", "subtitle"],
        "info": ["subtitle"],
        "persona": ["emotion"],
        "daily_moment": ["rhythm", "emotion"],
    }

    def __init__(self, skill: str = "video-editing", root: Optional[Path] = None):
        self.skill = skill
        self.skill_dir = (root or SKILLS_ROOT) / skill
        self._ref_cache: dict[str, str] = {}

    # ---- reference 文件操作 ----

    def reference_path(self, name: str) -> Path:
        # 允许传 "hook" 或 "hook.md"
        name = name[:-3] if name.endswith(".md") else name
        return self.skill_dir / "references" / f"{name}.md"

    def list_references(self) -> list[str]:
        ref_dir = self.skill_dir / "references"
        if not ref_dir.exists():
            return []
        return sorted(p.stem for p in ref_dir.glob("*.md"))

    def load_reference(self, name: str) -> str:
        name = name[:-3] if name.endswith(".md") else name
        if name not in self._ref_cache:
            p = self.reference_path(name)
            self._ref_cache[name] = p.read_text(encoding="utf-8") if p.exists() else ""
        return self._ref_cache[name]

    def load_skill_meta(self) -> dict:
        """解析 SKILL.md 的轻量元信息（名称 / 定位 / 使用时机 / 路由规则）。"""
        p = self.skill_dir / "SKILL.md"
        if not p.exists():
            return {"skill": self.skill, "name": self.skill, "description": "", "references": self.list_references()}
        text = p.read_text(encoding="utf-8")
        meta: dict = {"skill": self.skill, "references": self.list_references()}
        # 简单的 frontmatter（name: / description: / when_to_use: / priority:）
        for key in ("name", "description", "when_to_use", "priority"):
            m = re.search(rf"^{key}:\s*(.+)$", text, flags=re.MULTILINE)
            if m:
                meta[key] = m.group(1).strip()
        return meta

    # ---- 确定性路由 ----

    def route_for_stage(self, stage: str) -> list[str]:
        """按规划阶段确定要加载的 reference。"""
        return list(self.STAGE_TO_REFS.get(stage, []))

    def route_for_shot(self, shot_function: str) -> list[str]:
        """按镜头结构功能确定要加载的 reference。"""
        return list(self.SHOT_FUNCTION_TO_REFS.get(shot_function, ["rhythm", "emotion"]))

    def route_for_gene(self, gene) -> SkillPlan:
        """给定 StructureGene，确定性汇总需要加载的 reference。"""
        plan = SkillPlan(skill=self.skill)
        plan.references = ["structure-adaptation"]  # 结构迁移必然涉及适配
        plan.triggers["structure-adaptation"] = "结构迁移默认需要把 Gene 适配到用户素材"

        functions = set()
        shot_genes = getattr(gene, "shot_genes", []) or []
        for g in shot_genes:
            fn = getattr(g, "function", "")
            if fn:
                functions.add(fn)

        for fn in functions:
            refs = self.route_for_shot(fn)
            for r in refs:
                if r not in plan.references:
                    plan.references.append(r)
                    plan.triggers[r] = f"Gene 含 {fn} 镜头功能"

        # 存在 establishing 类功能 → 强制 material-matching（功能级素材迁移）
        if any(f in ("establishing", "scene_establish") for f in functions):
            if "material-matching" not in plan.references:
                plan.references.append("material-matching")
                plan.triggers["material-matching"] = "存在场景建立镜头，需功能级素材匹配"

        return plan

    def collect(self, names: list[str]) -> list[SkillReference]:
        """批量加载 reference，返回 [{name, content}]。"""
        out: list[SkillReference] = []
        seen = set()
        for n in names:
            key = n[:-3] if n.endswith(".md") else n
            if key in seen:
                continue
            seen.add(key)
            out.append(SkillReference(name=key, content=self.load_reference(key)))
        return out

    # ---- LLM 语义兜底（可选，非必需）----

    async def route_by_llm(self, context: str, llm) -> list[str]:
        """确定性规则覆盖不到时，用 LLM 语义判断该加载哪些 reference。

        仅作为兜底；正常路径优先走 route_for_stage / route_for_gene。
        """
        available = self.list_references()
        prompt = (
            "你是剪辑知识路由助手。根据当前规划上下文，从下列剪辑知识中选择"
            "最相关的一项或多项（只返回文件名，逗号分隔，不要解释）。\n\n"
            f"可选：{', '.join(available)}\n\n上下文：\n{context}"
        )
        try:
            resp = await llm.chat(prompt)
            picked = [w.strip().rstrip(".md") for w in re.split(r"[,\n]", resp)]
            return [p for p in picked if p in set(available)]
        except Exception:
            return []
