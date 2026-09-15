from render_knowledge_demos import demo_spec


def test_personal_knowledge_types_use_matching_teaching_demos():
    assert demo_spec({"type": "structure_template", "structured_data": {}}) == (
        "emotion_arc",
        "structure_arc",
    )
    assert demo_spec({"type": "hook_technique", "structured_data": {}}) == (
        "montage",
        "hook",
    )
    assert demo_spec({"type": "rhythm_pattern", "structured_data": {}}) == (
        "beat",
        "beat",
    )
    assert demo_spec({"type": "emotion_design", "structured_data": {}}) == (
        "emotion_arc",
        "emotion_arc",
    )
    assert demo_spec({"type": "packaging_style", "structured_data": {}}) == (
        "packaging",
        "douyin_travel_fast",
    )
