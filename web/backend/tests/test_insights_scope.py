from pathlib import Path
from types import SimpleNamespace

from routers import insights


def test_personal_scope_only_scans_user_gene_directory(monkeypatch, tmp_path):
    storage = tmp_path / "storage"
    mine = storage / "users" / "7" / "genes"
    mine.mkdir(parents=True)
    monkeypatch.setattr(insights, "STORAGE_ROOT", storage)

    assert insights._scan_roots(7) == [mine]


def test_safe_response_does_not_expose_filesystem_paths():
    shot = SimpleNamespace(
        index=0,
        to_dict=lambda: {
            "index": 0,
            "start": 0,
            "end": 1,
            "duration": 1,
            "shot_type": "hook",
            "emotion": "震撼",
            "transition": "cut",
        },
    )
    video = SimpleNamespace(
        video_path="C:/private/uploads/demo.mp4",
        source="C:/private/users/7/genes/2/report.json",
        format="new",
        duration=1,
        shots=[shot],
        hook_method="视觉冲击",
        structure_type="节奏型",
        overall_emotion="震撼",
        front_3s_shot_count=1,
        rhythm_curve=[],
        shot_details=[{"index": 0, "frame_paths": ["C:/private/frame.jpg"]}],
    )
    mined = {
        "generated_at": "2026-09-11T00:00:00",
        "insights": [{
            "dimension": "hook",
            "finding": "test",
            "sample_size": 1,
            "confidence": "low",
            "data": {},
            "sources": [video.source],
        }],
    }

    payload = insights._response_payload(mined, [video])

    assert payload["mode"] == "single"
    assert payload["videos"][0]["name"] == "demo.mp4"
    assert "source" not in payload["videos"][0]
    assert "sources" not in payload["insights"][0]
    assert "private" not in str(payload)
