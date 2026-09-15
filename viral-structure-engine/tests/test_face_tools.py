import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tools import face_tools


def test_missing_legacy_cascade_api_degrades_gracefully(monkeypatch):
    monkeypatch.delattr(face_tools.cv2, "CascadeClassifier", raising=False)

    detector = face_tools.FaceTools()

    assert detector.face_cascade is None
    assert detector.detect("missing-image.jpg") == []
