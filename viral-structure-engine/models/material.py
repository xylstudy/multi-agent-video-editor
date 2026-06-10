from dataclasses import dataclass, field
from enum import Enum
from models.video_structure import ShotType


class MaterialType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    TEXT = "text"


class MaterialQuality(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNUSABLE = "unusable"


@dataclass
class MaterialItem:
    id: str
    type: MaterialType
    path: str

    description: str = ""
    main_subject: str = ""
    tags: list[str] = field(default_factory=list)

    quality: MaterialQuality = MaterialQuality.MEDIUM
    quality_notes: str = ""
    suitable_for: list[ShotType] = field(default_factory=list)
    emotion_label: str = ""
    scene_type: str = ""
    light_quality: str = ""
    has_face: bool = False
    face_count: int = 0
    main_face_region: tuple = ()
    suggested_motion: str = ""
    highlight_clips: list[dict] = field(default_factory=list)
    content_segments: list[dict] = field(default_factory=list)
    has_usable_audio: bool = False
    is_ai_generated: bool = False
    generation_prompt: str = ""
    source_gap_index: int = -1
    vlog_value: str = "medium"
    vlog_applicability: list[dict] = field(default_factory=list)
    resolution: str = "medium"
    composition: str = "okay"
    light: str = "sufficient"
    duration: float = 0.0
    width: int = 0
    height: int = 0
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type.value,
            "path": self.path,
            "description": self.description,
            "main_subject": self.main_subject,
            "tags": self.tags,
            "quality": self.quality.value,
            "quality_notes": self.quality_notes,
            "resolution": self.resolution,
            "composition": self.composition,
            "light": self.light,
            "duration": self.duration,
            "width": self.width,
            "height": self.height,
            "has_face": self.has_face,
            "face_count": self.face_count,
            "emotion_label": self.emotion_label,
            "scene_type": self.scene_type,
            "vlog_value": self.vlog_value,
            "vlog_applicability": self.vlog_applicability,
            "highlight_clips": self.highlight_clips,
            "content_segments": self.content_segments,
            "is_ai_generated": self.is_ai_generated,
        }


@dataclass
class MaterialGap:
    slot_index: int
    required_type: ShotType
    purpose: str = ""
    needed_content: str = ""
    priority: int = 3
    impact_if_not_filled: str = ""
    suggested_strategy: str = ""
    strategy_detail: str = ""
    alternative_strategies: list[str] = field(default_factory=list)
    is_filled: bool = False
    filled_by: str = ""
    filled_material_id: str = ""
    fill_quality: str = ""
    fill_strategy: str = ""

    # 旧版兼容
    shot_type: ShotType = ShotType.DAILY_MOMENT
    required_duration: float = 3.0
    description: str = ""
    source_material_id: str = ""
    gap_type: str = "missing"

    def __post_init__(self):
        if not self.purpose and self.description:
            self.purpose = self.description
        if not self.needed_content and self.description:
            self.needed_content = self.description

    def to_dict(self) -> dict:
        return {
            "slot_index": self.slot_index,
            "required_type": self.required_type.value if isinstance(self.required_type, ShotType) else self.required_type,
            "purpose": self.purpose,
            "needed_content": self.needed_content,
            "priority": self.priority,
            "is_filled": self.is_filled,
            "fill_strategy": self.fill_strategy if self.fill_strategy else self.suggested_strategy,
            "source_material_id": self.filled_material_id or self.source_material_id,
        }


@dataclass
class MaterialInventory:
    items: list[MaterialItem] = field(default_factory=list)
    gaps: list[MaterialGap] = field(default_factory=list)
    coverage_rate: float = 0
    face_material_count: int = 0
    scene_material_count: int = 0
    text_material_count: int = 0

    # 旧版兼容
    materials: list[MaterialItem] = field(default_factory=list)

    def __post_init__(self):
        if self.materials and not self.items:
            self.items = self.materials
        elif self.items and not self.materials:
            self.materials = self.items

    def get_filled_gaps(self) -> list[MaterialGap]:
        return [g for g in self.gaps if g.is_filled]

    def get_unfilled_gaps(self) -> list[MaterialGap]:
        return [g for g in self.gaps if not g.is_filled]

    def get_high_priority_gaps(self, threshold: int = 3) -> list[MaterialGap]:
        return [g for g in self.get_unfilled_gaps() if g.priority >= threshold]

    def get_items_by_shot_type(self, shot_type: ShotType) -> list[MaterialItem]:
        return [m for m in self.items if shot_type in m.suitable_for]

    def get_face_items(self) -> list[MaterialItem]:
        return [m for m in self.items if m.has_face]

    def to_dict(self) -> dict:
        return {
            "items": [m.to_dict() for m in self.items],
            "gaps": [g.to_dict() for g in self.gaps],
            "coverage_rate": self.coverage_rate,
            "materials_count": len(self.items),
            "gaps_count": len(self.gaps),
        }
