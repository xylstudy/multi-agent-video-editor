import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from skills.router import SkillRouter, SkillReference
from models.gene import ShotGene, StructureGene
from prompts.planner_prompts import build_scheme_generate_prompt, _format_skill_context
from prompts.reviewer_prompts import build_review_prompt


def _gene_with_functions(*functions):
    return StructureGene(source_id="v1", shot_genes=[
        ShotGene(index=i, function=f) for i, f in enumerate(functions)
    ])


def test_stage_routing_hook_only():
    """Case 2：规划 hook 阶段时，只加载 hook.md，不加载 transition/subtitle。"""
    router = SkillRouter()
    assert router.route_for_stage("hook") == ["hook"]
    assert "transition" not in router.route_for_stage("hook")
    assert "subtitle" not in router.route_for_stage("hook")


def test_stage_routing_transition():
    router = SkillRouter()
    assert router.route_for_stage("transition") == ["transition"]


def test_gene_routing_hook_only():
    """Case 2：Gene 只含 hook 时，只加载 structure-adaptation + hook，不带转场/字幕。"""
    router = SkillRouter()
    plan = router.route_for_gene(_gene_with_functions("hook"))
    assert plan.references[0] == "structure-adaptation"  # 结构迁移必然适配
    assert "hook" in plan.references
    assert "transition" not in plan.references
    assert "subtitle" not in plan.references


def test_gene_routing_establishing_material_matching():
    """Case 3：存在 establishing 镜头 → 强制加载 material-matching（功能级素材迁移）。"""
    router = SkillRouter()
    plan = router.route_for_gene(_gene_with_functions("establishing", "climax"))
    assert "material-matching" in plan.references
    assert "structure-adaptation" in plan.references
    assert "emotion" in plan.references  # climax 触发情绪
    assert "rhythm" in plan.references   # climax 触发节奏


def test_reference_content_loaded():
    router = SkillRouter()
    hook = router.load_reference("hook")
    assert hook  # 非空
    # 每个 reference 都有 适用条件 / 不适用条件 / 推荐策略
    assert "适用" in hook or "不适用" in hook or "推荐" in hook


def test_skill_meta_priority():
    """Case 4：Skill 元信息声明了优先级，Gene 高于 Skill。"""
    router = SkillRouter()
    meta = router.load_skill_meta()
    assert "Gene" in meta.get("priority", "")
    assert "Skill" in meta.get("priority", "")


def test_skill_cannot_override_gene_in_prompt():
    """Case 4：Planner prompt 的决策优先级把 Gene 硬约束置于 Skill 之上。"""
    p = build_scheme_generate_prompt(
        skeleton_json="{}", inventory_json="[]", target_topic="t", target_info="i",
        preferences="{}", gene_json='{"shot_genes":[]}', skill_context=[SkillReference("hook", "内容")],
    )
    assert "决策优先级" in p
    assert "Reference Gene" in p and "Editing Skill" in p
    assert "不覆盖 Gene" in p
    assert "Structure Transfer" in p


def test_format_skill_context():
    """按需加载：只有传入的 Skill 才进 prompt，且带明确的 reference 标题。"""
    refs = [{"name": "hook", "content": "hook 内容"}, {"name": "rhythm", "content": "rhythm 内容"}]
    out = _format_skill_context(refs)
    assert "===== Skill 参考：hook.md =====" in out
    assert "===== Skill 参考：rhythm.md =====" in out
    # 字符串直接透传
    assert _format_skill_context("raw string") == "raw string"
    # 空 -> 空
    assert _format_skill_context(None) == ""


def test_gene_section_in_prompt():
    """Case 1：Gene 始终进入 Planner prompt 作为核心约束（无 gene 时不注入）。"""
    p_no_gene = build_scheme_generate_prompt("{}", "[]", "t", "i", "{}", gene_json="", skill_context=None)
    assert "参考视频结构基因" not in p_no_gene
    p_with_gene = build_scheme_generate_prompt(
        "{}", "[]", "t", "i", "{}",
        gene_json='{"source_id":"v1"}', skill_context=None,
    )
    assert "结构基因" in p_with_gene
    assert "参考视频结构基因" in p_with_gene


def test_reviewer_two_groups():
    """Case 6：Reviewer prompt 同时区分 Fidelity 与 Quality。"""
    p = build_review_prompt(
        "源结构摘要", '{"storyboard":[]}', "素材覆盖", gene_json='{"source_id":"v1"}',
    )
    assert "Gene / Structure Fidelity" in p
    assert "Adaptation / Editing Quality" in p
    assert "feedback_type" in p
    assert "fidelity" in p and "quality" in p
    assert '"suggestions"' in p and '"category"' in p


if __name__ == "__main__":
    test_stage_routing_hook_only()
    test_stage_routing_transition()
    test_gene_routing_hook_only()
    test_gene_routing_establishing_material_matching()
    test_reference_content_loaded()
    test_skill_meta_priority()
    test_skill_cannot_override_gene_in_prompt()
    test_format_skill_context()
    test_gene_section_in_prompt()
    test_reviewer_two_groups()
    print("All skill tests passed!")
