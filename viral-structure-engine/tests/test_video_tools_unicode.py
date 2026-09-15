import sys
import uuid
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tools.video_tools import _imwrite


def test_imwrite_supports_unicode_paths():
    temp_root = Path(__file__).parent / f"_unicode_output_{uuid.uuid4().hex}"
    output = temp_root / "中文目录" / "关键帧.jpg"
    image = np.zeros((24, 32, 3), dtype=np.uint8)

    try:
        _imwrite(str(output), image)

        decoded = cv2.imdecode(np.fromfile(output, dtype=np.uint8), cv2.IMREAD_COLOR)
        assert output.is_file()
        assert decoded.shape == (24, 32, 3)
    finally:
        if output.exists():
            output.unlink()
        if output.parent.exists():
            output.parent.rmdir()
        if temp_root.exists():
            temp_root.rmdir()
