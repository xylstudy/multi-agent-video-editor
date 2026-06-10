import logging
from pathlib import Path
from typing import Optional

import numpy as np
import cv2

logger = logging.getLogger(__name__)


class FaceTools:
    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )

    @staticmethod
    def _imread(image_path: str):
        return cv2.imdecode(np.fromfile(image_path, dtype=np.uint8), cv2.IMREAD_COLOR)

    def detect(self, image_path: str) -> list[dict]:
        img = self._imread(image_path)
        if img is None:
            raise ValueError(f"Cannot read image: {image_path}")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

        img_area = img.shape[0] * img.shape[1]
        return [{"bbox": (int(x), int(y), int(w), int(h)), "confidence": 0.95, "area_ratio": (w * h) / img_area}
                for x, y, w, h in faces]

    def has_face(self, image_path: str) -> bool:
        return len(self.detect(image_path)) > 0

    def get_main_face_region(self, image_path: str) -> Optional[tuple]:
        faces = self.detect(image_path)
        if not faces:
            return None
        main = max(faces, key=lambda r: r["area_ratio"])
        return main["bbox"]

    def get_face_crop(self, image_path: str, expand_ratio: float = 1.5) -> str:
        img = self._imread(image_path)
        if img is None:
            raise ValueError(f"Cannot read image: {image_path}")

        h_img, w_img = img.shape[:2]
        faces = self.detect(image_path)

        if not faces:
            out = str(Path(image_path).parent / f"crop_{Path(image_path).name}")
            cv2.imwrite(out, img)
            return out

        main = max(faces, key=lambda r: r["area_ratio"])
        x, y, w, h = main["bbox"]
        cx, cy = x + w // 2, y + h // 2
        new_size = max(w, h) * expand_ratio

        x1 = max(0, int(cx - new_size // 2))
        y1 = max(0, int(cy - new_size // 2))
        x2 = min(w_img, int(cx + new_size // 2))
        y2 = min(h_img, int(cy + new_size // 2))

        crop = img[y1:y2, x1:x2]
        out = str(Path(image_path).parent / f"crop_{Path(image_path).name}")
        cv2.imwrite(out, crop)
        return out
