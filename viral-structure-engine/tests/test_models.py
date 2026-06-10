import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models.material import (
    MaterialItem, MaterialGap, MaterialInventory, MaterialType, MaterialQuality,
)
from models.video_structure import (
    ShotInfo, ShotType, TransitionType, RhythmPoint, SubtitleStyle,
    PackagingStyle, BGMInfo, VlogMeta, VideoStructure,
)
from models.scheme import VideoScheme, StoryboardFrame
from models.knowledge import KnowledgeEntry, KnowledgeType


def test_shot_info():
    shot = ShotInfo(index=0, start_time=0.0, end_time=3.0, duration=3.0,
                    shot_type=ShotType.HOOK, emotion="欢乐")
    assert shot.index == 0
    assert shot.shot_type == ShotType.HOOK
    assert isinstance(shot.to_dict(), dict)


def test_shot_info_preprocessing_fields():
    """验证 ShotInfo 新增的预处理字段"""
    shot = ShotInfo(index=0, start_time=0.0, end_time=3.0, duration=3.0,
                    shot_type=ShotType.HOOK,
                    motion_intensity=0.75,
                    color_stats={"hue_mean": 30.5, "dominant_colors": ["#4A7FB5"]},
                    audio_type="speech")
    assert shot.motion_intensity == 0.75
    assert shot.color_stats["hue_mean"] == 30.5
    assert shot.audio_type == "speech"
    d = shot.to_dict()
    assert d["motion_intensity"] == 0.75
    assert d["audio_type"] == "speech"
    assert d["color_stats"]["dominant_colors"][0] == "#4A7FB5"

    # 验证默认值
    shot_default = ShotInfo(index=1, start_time=0.0, end_time=1.0, duration=1.0,
                            shot_type=ShotType.DAILY_MOMENT)
    assert shot_default.motion_intensity == 0.0
    assert shot_default.color_stats == {}
    assert shot_default.audio_type == ""
    assert shot_default.to_dict()["motion_intensity"] == 0.0


def test_rhythm_point():
    rp = RhythmPoint(time=10.0, intensity=0.8, note="高潮")
    assert rp.time == 10.0
    d = rp.to_dict()
    assert d["note"] == "高潮"


def test_subtitle_style():
    s = SubtitleStyle(font_family="黑体", position="bottom")
    d = s.to_dict()
    assert d["font_family"] == "黑体"


def test_packaging_style():
    p = PackagingStyle(color_grade="japanese_fresh")
    d = p.to_dict()
    assert d["color_grade"] == "japanese_fresh"


def test_bgm_info():
    b = BGMInfo(style="轻快", bpm=120)
    d = b.to_dict()
    assert d["bpm"] == 120


def test_vlog_meta():
    m = VlogMeta(narrative_type="timeline", structure_type="情绪递进型", hook_method="视觉冲击")
    d = m.to_dict()
    assert d["narrative_type"] == "timeline"


def test_video_structure_new_fields():
    vs = VideoStructure(
        source_id="test_video",
        source_path="/path/to/video.mp4",
        duration=60.0,
        resolution=(1080, 1920),
        structure_summary="悬念前置型结构",
        hook_summary="视觉冲击开场",
    )
    assert vs.source_id == "test_video"
    assert vs.structure_summary == "悬念前置型结构"
    d = vs.to_dict()
    assert d["resolution"] == [1080, 1920]
    assert d["hook_summary"] == "视觉冲击开场"


def test_material_item_new_fields():
    item = MaterialItem(
        id="img_001", type=MaterialType.IMAGE, path="/pic.jpg",
        quality=MaterialQuality.HIGH,
        has_face=True, face_count=2, scene_type="咖啡厅",
        is_ai_generated=False,
    )
    assert item.has_face is True
    assert item.face_count == 2
    assert item.scene_type == "咖啡厅"
    d = item.to_dict()
    assert d["scene_type"] == "咖啡厅"
    assert d["is_ai_generated"] is False


def test_material_gap_new_fields():
    gap = MaterialGap(
        slot_index=0, required_type=ShotType.HOOK,
        purpose="缺少开场hook素材", priority=5,
        suggested_strategy="Ken Burns效果",
        impact_if_not_filled="观众不会停留",
    )
    assert gap.required_type == ShotType.HOOK
    assert gap.priority == 5
    assert gap.suggested_strategy == "Ken Burns效果"
    d = gap.to_dict()
    assert d["required_type"] == "hook"


def test_material_inventory_new():
    mat = MaterialItem(id="m1", type=MaterialType.IMAGE, path="/m1.jpg")
    gap = MaterialGap(slot_index=0, required_type=ShotType.HOOK, purpose="hook", priority=1)
    inv = MaterialInventory(items=[mat], gaps=[gap])
    assert len(inv.items) == 1
    assert len(inv.gaps) == 1
    assert len(inv.get_unfilled_gaps()) == 1
    assert len(inv.get_high_priority_gaps(threshold=3)) == 0
    d = inv.to_dict()
    assert "coverage_rate" in d


def test_storyboard_frame():
    frame = StoryboardFrame(index=0, start_time=0, end_time=3.0, duration=3.0,
                            purpose="开篇", shot_type=ShotType.HOOK,
                            visual_content="咖啡厅门口", has_face=False)
    assert frame.index == 0
    assert frame.shot_type == ShotType.HOOK
    assert frame.visual_content == "咖啡厅门口"


def test_video_scheme():
    frame = StoryboardFrame(index=0, start_time=0, end_time=3.0, duration=3.0,
                            purpose="hook画面", shot_type=ShotType.HOOK)
    scheme = VideoScheme(
        id="scheme_0", title="探店Vlog", target_topic="周末探店",
        target_duration=60.0, storyboard=[frame],
    )
    assert scheme.id == "scheme_0"
    assert scheme.target_duration == 60.0


def test_video_scheme_new_fields():
    frame = StoryboardFrame(
        index=0, start_time=0, end_time=3.0, duration=3.0,
        purpose="开场", shot_type=ShotType.HOOK,
        text_card_content="出发！", text_card_style={"bg_color": "white"},
        motion_effect="zoom_in", gap_fill_strategy="文字卡替代",
    )
    assert frame.text_card_content == "出发！"
    assert frame.motion_effect == "zoom_in"
    assert frame.gap_fill_strategy == "文字卡替代"


def test_knowledge_entry():
    entry = KnowledgeEntry(
        id="k_001", type=KnowledgeType.STRUCTURE_TEMPLATE,
        title="悬念前置模板", content="先抛结果再回溯过程",
        confidence=0.85,
    )
    assert entry.type == KnowledgeType.STRUCTURE_TEMPLATE
    d = entry.to_dict()
    assert d["title"] == "悬念前置模板"
    assert d["confidence"] == 0.85


if __name__ == "__main__":
    test_shot_info()
    test_rhythm_point()
    test_subtitle_style()
    test_packaging_style()
    test_bgm_info()
    test_vlog_meta()
    test_video_structure_new_fields()
    test_material_item_new_fields()
    test_material_gap_new_fields()
    test_material_inventory_new()
    test_storyboard_frame()
    test_video_scheme()
    test_video_scheme_new_fields()
    test_knowledge_entry()
    print("All model tests passed!")
