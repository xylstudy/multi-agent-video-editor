import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models.gene import (
    ConstraintKind,
    GeneConstraint,
    ShotGene,
    StructureGene,
    build_gene,
)
from models.scheme import StoryboardFrame, VideoScheme
from models.video_structure import ShotType, VideoStructure


def _shot(primary, emotion="", start=0.0, end=3.0, summary=""):
    return {
        "start_time": start,
        "end_time": end,
        "emotion": emotion,
        "one_sentence_summary": summary,
        "structure_role": {"primary_function": primary, "reasoning": f"{primary} 功能"},
        "technique": {"camera_movement": ""},
    }


def test_shot_gene_roundtrip():
    g = ShotGene(index=0, function="establishing", importance="high",
                 visual_requirement="宽景/地标", hard_constraints=["保留场景建立"],
                 soft_preferences=["可用宽景替代"])
    d = g.to_dict()
    assert d["function"] == "establishing"
    assert d["importance"] == "high"
    assert "保留场景建立" in d["hard_constraints"]


def test_gene_constraint_kind():
    c = GeneConstraint(description="保留 Hook", kind=ConstraintKind.HARD.value)
    assert c.to_dict()["kind"] == "hard"


def test_structure_gene_critical_shots():
    gene = StructureGene(shot_genes=[
        ShotGene(index=0, function="hook", importance="critical"),
        ShotGene(index=1, function="daily_moment", importance="medium"),
    ], hard_constraints=["保持 Hook 前 3 秒抓注意力"])
    assert len(gene.critical_shots()) == 1
    assert gene.critical_shots()[0].function == "hook"
    assert "硬" in gene.hard_constraint_text()
    assert "Hook" in gene.hard_constraint_text()


def test_build_gene_functional_requirement():
    """Case 1 + Case 3：Gene 表达结构功能，且 establishing 有功能性画面要求（非物体复制）。"""
    analyses = [
        _shot("hook", emotion="期待", start=0, end=2, summary="开场抓眼球"),
        _shot("scene_establish", emotion="震撼", start=2, end=5, summary="航拍地标"),
        _shot("emotion_peak", emotion="感动", start=5, end=9, summary="情绪高点"),
        _shot("closing_moment", emotion="余韵", start=9, end=12, summary="收尾"),
    ]
    structure = {
        "structure_type": {"category": "情绪递进型"},
        "narrative_type": "timeline",
        "overall_emotion": "治愈",
        "rhythm_analysis": {"pattern": "快-慢-快", "climax_position_percent": 60},
        "hook_strategy": {"method": "视觉冲击"},
    }
    gene = build_gene(analyses, structure, source_id="v1", duration=12.0)

    assert isinstance(gene, StructureGene)
    assert len(gene.shot_genes) == 4
    # hook 是关键结构
    assert gene.shot_genes[0].function == "hook"
    assert gene.shot_genes[0].importance == "critical"
    # establishing 的功能性画面要求（不是"复制航拍物体"）
    assert gene.shot_genes[1].function == "establishing"
    assert "宽景" in gene.shot_genes[1].visual_requirement or "地标" in gene.shot_genes[1].visual_requirement
    # 硬约束记录了结构骨架 + 高潮位置
    assert any("高潮位置" in c for c in gene.hard_constraints)
    # emotion_peak → climax 功能
    assert gene.shot_genes[2].function == "climax"


def test_video_structure_carries_gene():
    """Case 1：Gene 挂在 VideoStructure 上并能序列化。"""
    gene = StructureGene(source_id="v1", shot_genes=[ShotGene(index=0, function="hook")])
    vs = VideoStructure(source_id="v1", source_path="/v.mp4", duration=10.0, gene=gene)
    d = vs.to_dict()
    assert d["gene"]["source_id"] == "v1"
    assert d["gene"]["shot_genes"][0]["function"] == "hook"


def test_scheme_traceability_fields():
    """Case 5：VideoScheme 能追踪 Gene → Material → Skill → Adaptation。"""
    frame = StoryboardFrame(
        index=0, start_time=0, end_time=3.0, duration=3.0,
        shot_type=ShotType.SCENE_ESTABLISH, purpose="场景建立",
        structure_function="establishing", gene_shot_index=1,
        skill_refs=["material-matching"],
        adaptation={"preserved": True, "reason": "无航拍，用宽景地标替代",
                    "original_function": "establishing"},
    )
    scheme = VideoScheme(
        title="t", storyboard=[frame],
        gene_refs=["v1"], skill_refs_used=["material-matching", "structure-adaptation"],
        adaptation_log=[{"gene_shot_index": 1, "original_function": "establishing",
                         "adapted_to": "宽景地标", "reason": "无航拍素材"}],
    )
    d = scheme.to_dict()
    assert d["gene_refs"] == ["v1"]
    assert "material-matching" in d["skill_refs_used"]
    assert d["adaptation_log"][0]["reason"] == "无航拍素材"
    assert d["storyboard"][0]["structure_function"] == "establishing"
    assert d["storyboard"][0]["gene_shot_index"] == 1
    assert d["storyboard"][0]["skill_refs"] == ["material-matching"]


if __name__ == "__main__":
    test_shot_gene_roundtrip()
    test_gene_constraint_kind()
    test_structure_gene_critical_shots()
    test_build_gene_functional_requirement()
    test_video_structure_carries_gene()
    test_scheme_traceability_fields()
    print("All gene tests passed!")
