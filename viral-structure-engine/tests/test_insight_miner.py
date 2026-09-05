import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from knowledge.insight_miner import (
    InsightMiner,
    discover_analyses,
    normalize_legacy_format,
    normalize_new_format,
)
from insight_report import generate_report


def _shot(index, stype, start, end, emotion="活力", transition="cut"):
    return {"index": index, "shot_type": stype, "start_time": start, "end_time": end,
            "duration": end - start, "emotion": emotion, "transition_in": transition}


def _write_new_report(tmp_path: Path, name, shots, hook_method="视觉冲击",
                      structure_type="节奏卡点型", overall_emotion="活力",
                      transitions=None, duration=30.0):
    report = {
        "source_path": f"/videos/{name}.mp4",
        "duration": duration,
        "resolution": [720, 1280],
        "shot_count": len(shots),
        "vlog_meta": {"hook_method": hook_method, "structure_type": structure_type,
                      "overall_emotion": overall_emotion},
        "shots": shots,
        "raw_structure_analysis": {
            "packaging_analysis": {"transitions_used": [
                {"between": f"镜头{i}到镜头{i+1}", "type": t} for i, t in enumerate(transitions or [])]},
            "rhythm_analysis": {"curve_points": [{"time": 0, "intensity": 0.8}]},
        },
        "raw_shot_analyses": [],
    }
    # 每个视频一个子目录：discover_analyses 按精确文件名 analysis_result.json 匹配
    d = tmp_path / name
    d.mkdir(exist_ok=True)
    p = d / "analysis_result.json"
    p.write_text(json.dumps(report, ensure_ascii=False), encoding="utf-8")
    return p


def test_normalize_new_format(tmp_path):
    p = _write_new_report(
        tmp_path, "a",
        [_shot(0, "hook", 0, 1.0, "震撼"), _shot(1, "daily_moment", 1.0, 3.5, "温馨"),
         _shot(2, "closing_moment", 3.5, 5.0, "治愈")],
        transitions=["cut", "whip"],
    )
    data = normalize_new_format(p)
    assert data is not None
    assert data.format == "new"
    assert len(data.shots) == 3
    assert data.shots[0].shot_type == "hook"
    assert data.shots[1].duration == 2.5
    assert data.front_3s_shot_count == 2  # 前3秒: 镜头0(0-1s) + 镜头1(1-3.5s)
    assert data.hook_method == "视觉冲击"
    assert data.transitions_used == ["cut", "whip"]


def test_normalize_new_format_bad_timing_falls_back(tmp_path):
    """shots 时间全为 0 时，回退到 raw_shot_analyses 的时间。"""
    p = _write_new_report(tmp_path, "b", [_shot(0, "hook", 0, 0), _shot(1, "hook", 0, 0)])
    report = json.loads(p.read_text(encoding="utf-8"))
    report["raw_shot_analyses"] = [
        {"shot_index": 0, "start_time": 0, "end_time": 1.0},
        {"shot_index": 1, "start_time": 1.0, "end_time": 4.0},
    ]
    p.write_text(json.dumps(report, ensure_ascii=False), encoding="utf-8")
    data = normalize_new_format(p)
    assert data.shots[0].duration == 1.0
    assert data.shots[1].duration == 3.0


def test_normalize_legacy_format(tmp_path):
    analyst = tmp_path / "analyst"
    analyst.mkdir()
    (analyst / "shot_analyses.json").write_text(json.dumps([
        {"shot_index": 0, "start_time": 0, "end_time": 0.8,
         "structure_role": {"primary_function": "hook"}, "emotion": "活力"},
        {"shot_index": 1, "start_time": 0.8, "end_time": 2.4,
         "structure_role": {"primary_function": "persona"}, "emotion": "温馨"},
    ], ensure_ascii=False), encoding="utf-8")
    (analyst / "structure_analysis.json").write_text(json.dumps({
        "hook_strategy": {"method": "金句开头"},
        "structure_type": {"category": "情绪递进型"},
        "overall_emotion": "治愈",
        "packaging_analysis": {"transitions_used": [{"type": "fade"}]},
    }, ensure_ascii=False), encoding="utf-8")

    data = normalize_legacy_format(analyst)
    assert data is not None
    assert data.format == "legacy"
    assert data.shots[1].shot_type == "persona_expression"  # 别名归一
    assert data.front_3s_shot_count == 2
    assert data.hook_method == "金句开头"
    assert data.transitions_used == ["fade"]


def test_miner_produces_five_dimensions(tmp_path):
    _write_new_report(
        tmp_path, "v1",
        [_shot(0, "hook", 0, 0.8, "震撼"), _shot(1, "scene_establish", 0.8, 2.5, "温馨"),
         _shot(2, "daily_moment", 2.5, 4.0, "活力"), _shot(3, "daily_moment", 4.0, 5.5, "活力"),
         _shot(4, "daily_moment", 5.5, 7.0, "欢乐"), _shot(5, "closing_moment", 7.0, 8.0, "治愈")],
        hook_method="视觉冲击", transitions=["cut", "cut", "cut", "cut", "fade"],
        duration=8.0,
    )
    _write_new_report(
        tmp_path, "v2",
        [_shot(0, "hook", 0, 1.2, "热血"), _shot(1, "daily_moment", 1.2, 3.0, "活力"),
         _shot(2, "emotion_peak", 3.0, 4.5, "震撼"), _shot(3, "daily_moment", 4.5, 6.0, "欢乐"),
         _shot(4, "closing_moment", 6.0, 7.5, "温馨")],
        hook_method="视觉冲击", transitions=["cut", "flash_white", "cut", "fade"],
        duration=7.5,
    )

    videos = discover_analyses([tmp_path])
    assert len(videos) == 2

    mined = InsightMiner(videos).mine()
    dims = [i["dimension"] for i in mined["insights"]]
    assert dims == ["hook", "rhythm", "shot_types", "emotion_arc", "transitions"]
    assert mined["sample_size"] == 2

    for insight in mined["insights"]:
        assert insight["sample_size"] >= 1
        assert insight["confidence"] in ("low", "medium", "high")
        assert insight["finding"]

    hook = mined["insights"][0]
    assert hook["data"]["hook_methods"] == {"视觉冲击": 2}
    rhythm = mined["insights"][1]
    assert rhythm["data"]["median_shot_duration"] > 0


def test_confidence_levels():
    from knowledge.insight_miner import _confidence
    assert _confidence(1) == "low"
    assert _confidence(3) == "medium"
    assert _confidence(5) == "high"


def test_html_report_smoke(tmp_path):
    p = _write_new_report(
        tmp_path, "v1",
        [_shot(0, "hook", 0, 1.0, "震撼"), _shot(1, "closing_moment", 1.0, 2.5, "治愈")],
        duration=2.5,
    )
    videos = discover_analyses([tmp_path])
    mined = InsightMiner(videos).mine()
    out = generate_report(mined, videos, tmp_path / "report.html")

    text = out.read_text(encoding="utf-8")
    assert "Video Claw 洞察报告" in text
    assert "镜头时间线" in text
    assert "样本不足" in text  # n=1 → low confidence 徽章
    assert "showDetail" in text
    # 详情 JSON 已内嵌且可解析
    start = text.index('id="details">') + len('id="details">')
    end = text.index("</script>", start)
    payload = json.loads(text[start:end].replace("<\\/", "</"))
    assert payload[0][0]["shot_type"] == "hook"
