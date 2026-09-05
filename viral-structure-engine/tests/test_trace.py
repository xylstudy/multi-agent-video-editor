import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models.trace import (
    ANALYST_PROMPT_VERSION,
    KNOWLEDGE_EXTRACT_PROMPT_VERSION,
    STRUCTURE_INPUT_MAX_CHARS,
    AnalysisTrace,
    ShotTrace,
    make_analysis_trace,
    make_shot_trace,
)
from models.knowledge import KnowledgeEntry, KnowledgeType
from knowledge.store import KnowledgeStore


def test_shot_trace_roundtrip():
    shot = make_shot_trace(
        index=2, start_time=1.5, end_time=3.0,
        analysis={"emotion": "温馨", "structure_role": {"primary_function": "hook"}},
        frame_paths=["frames/shot_002.jpg"],
        motion_intensity=0.7, color_stats={"hue": 30},
        prev_context_summary="上一镜头是开场",
        model="glm-4.6v",
    )
    d = shot.to_dict()
    assert d["index"] == 2
    assert d["analysis"]["emotion"] == "温馨"
    assert d["prompt_version"] == ANALYST_PROMPT_VERSION
    # JSON 序列化可逆
    restored = json.loads(json.dumps(d, ensure_ascii=False))
    assert restored["prev_context_summary"] == "上一镜头是开场"
    assert restored["frame_paths"] == ["frames/shot_002.jpg"]


def test_make_shot_trace_none_tolerance():
    shot = make_shot_trace(index=0, analysis=None, frame_paths=None,
                           color_stats=None, prev_context_summary=None)
    assert isinstance(shot, ShotTrace)
    assert shot.frame_paths == []
    assert shot.color_stats == {}
    assert shot.analysis == {}
    assert shot.prev_context_summary == ""


def test_analysis_trace_roundtrip_and_truncation():
    shots = [make_shot_trace(index=i) for i in range(3)]
    long_input = "x" * (STRUCTURE_INPUT_MAX_CHARS + 500)
    trace = make_analysis_trace(
        video_path="/tmp/a.mp4", duration=15.8, resolution=[720, 1280],
        scene_count=16, audio_summary={"bpm": 120},
        shots=shots, structure_input_summary=long_input,
        structure_analysis={"structure_type": {"category": "悬念前置型"}},
        versions={"model": "glm-4.6v", "prompt_version": "v1"},
    )
    d = trace.to_dict()
    assert d["scene_count"] == 16
    assert len(d["shots"]) == 3
    # 超长结构输入被截断并标注
    assert len(d["structure_input_summary"]) <= STRUCTURE_INPUT_MAX_CHARS + 40
    assert "截断" in d["structure_input_summary"]
    assert d["versions"]["model"] == "glm-4.6v"
    assert trace.created_at  # 自动填充时间戳
    # JSON 可序列化
    json.dumps(d, ensure_ascii=False)


def test_make_analysis_trace_none_tolerance():
    trace = make_analysis_trace()
    d = trace.to_dict()
    assert isinstance(trace, AnalysisTrace)
    assert d["shots"] == []
    assert d["versions"] == {}
    assert d["resolution"] == []
    assert d["audio_summary"] == {}


def test_knowledge_entry_derivation_to_dict():
    entry = KnowledgeEntry(
        id="k_t0", type=KnowledgeType.HOOK_TECHNIQUE, title="测试",
        confidence=0.9,
        derivation={"source_gene_id": 3, "prompt_version": KNOWLEDGE_EXTRACT_PROMPT_VERSION},
    )
    d = entry.to_dict()
    assert d["derivation"]["source_gene_id"] == 3
    assert d["derivation"]["prompt_version"] == KNOWLEDGE_EXTRACT_PROMPT_VERSION


def test_store_loads_legacy_entry_without_derivation(tmp_path):
    """历史 knowledge.json 没有 derivation 字段，加载必须兼容。"""
    db = tmp_path / "knowledge.json"
    legacy = [{
        "id": "k_0",
        "type": "hook_technique",
        "title": "旧条目",
        "content": "无 derivation 字段的历史数据",
        "structured_data": {},
        "tags": [],
        "applicable_vlog_types": [],
        "best_when": "",
        "confidence": 0.8,
        "source_summary": "旧来源",
    }]
    db.write_text(json.dumps(legacy, ensure_ascii=False), encoding="utf-8")
    store = KnowledgeStore(db_path=db)
    entry = store.get_entry("k_0")
    assert entry is not None
    assert entry.derivation == {}
    assert "derivation" in entry.to_dict()


def test_store_persists_derivation(tmp_path):
    db = tmp_path / "knowledge.json"
    store = KnowledgeStore(db_path=db)
    entry = KnowledgeEntry(
        id="k_t1", type=KnowledgeType.RHYTHM_PATTERN, title="节奏模式",
        confidence=0.85,
        derivation={"source_gene_id": 7, "model": "deepseek-chat"},
    )
    store.add_entry(entry)

    store2 = KnowledgeStore(db_path=db)
    loaded = store2.get_entry("k_t1")
    assert loaded is not None
    assert loaded.derivation["source_gene_id"] == 7
    assert loaded.derivation["model"] == "deepseek-chat"


def test_scheme_knowledge_refs():
    from models.scheme import VideoScheme
    scheme = VideoScheme(title="t")
    assert scheme.knowledge_refs == []
    scheme.knowledge_refs = ["transition:cut", "subtitle:neon"]
    d = scheme.to_dict()
    assert d["knowledge_refs"] == ["transition:cut", "subtitle:neon"]
