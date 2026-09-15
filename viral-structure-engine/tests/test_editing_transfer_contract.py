import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from run_editing_transfer import build_photo_scheme, build_rule_based_acts
from run_pipeline_e2e import build_preferences
from run_storyboard_render import load_inventory


def test_rule_based_acts_need_no_analysis_report():
    acts, duration = build_rule_based_acts([
        {"start": 0.0, "end": 1.0, "duration": 1.0},
        {"start": 1.0, "end": 4.0, "duration": 3.0},
        {"start": 4.0, "end": 8.0, "duration": 4.0},
    ], bpm=120, beat_times=[0.0, 0.5, 1.0])

    assert duration == 8.0
    assert sum(act["shot_count"] for act in acts) == 3
    assert all(act["shot_beats"] for act in acts)


def test_editing_scheme_uses_project_topic_instead_of_demo_copy():
    acts = [{
        "index": 0,
        "purpose": "开场",
        "emotion": "期待",
        "rhythm": "快",
        "shot_count": 1,
        "duration": 1.0,
        "shot_beats": [2],
    }]
    photos = [{"id": "photo-1", "path": "one.jpg", "description": ""}]

    storyboard = build_photo_scheme(acts, photos, [], 120, topic="新品发布")

    assert storyboard[0]["subtitle_text"] == "新品发布"
    assert "北京" not in str(storyboard)


def test_agent_preferences_are_topic_neutral():
    preferences = build_preferences("咖啡探店")

    assert "咖啡探店" in preferences["style"]
    assert "北京" not in str(preferences)


def test_confirmed_renderer_loads_both_inventory_shapes(tmp_path):
    object_inventory = tmp_path / "object.json"
    list_inventory = tmp_path / "list.json"
    object_inventory.write_text('{"items": [{"id": "one"}]}', encoding="utf-8")
    list_inventory.write_text('[{"id": "two"}]', encoding="utf-8")

    assert load_inventory(str(object_inventory))[0]["id"] == "one"
    assert load_inventory(str(list_inventory))[0]["id"] == "two"
