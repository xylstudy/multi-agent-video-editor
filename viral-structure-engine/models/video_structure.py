from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from models.gene import StructureGene


class ShotType(str, Enum):
    HOOK = "hook"
    CTA = "cta"
    TRANSITION = "transition"
    SCENE_ESTABLISH = "scene_establish"
    DAILY_MOMENT = "daily_moment"
    EMOTION_PEAK = "emotion_peak"
    PERSONA_EXPRESSION = "persona"
    INFO_CARD = "info_card"
    CLOSING_MOMENT = "closing"
    PAIN_POINT = "pain_point"
    PRODUCT_SHOW = "product"
    USAGE_DEMO = "usage"
    COMPARISON = "comparison"


class TransitionType(str, Enum):
    CUT = "cut"
    FADE = "fade"
    DISSOLVE = "dissolve"
    ZOOM_IN = "zoom_in"
    ZOOM_OUT = "zoom_out"
    FLASH_WHITE = "flash_white"
    FLASH_BLACK = "flash_black"
    SLIDE = "slide"
    SLIDE_LEFT = "slide_left"
    SLIDE_RIGHT = "slide_right"
    SLIDE_UP = "slide_up"
    SLIDE_DOWN = "slide_down"
    WIPE_LEFT = "wipe_left"
    WIPE_RIGHT = "wipe_right"
    WIPE_UP = "wipe_up"
    WIPE_DOWN = "wipe_down"
    BLUR_IN = "blur_in"
    ROTATE_IN = "rotate_in"
    WHIP = "whip"
    MASK = "mask"
    CIRCLE_REVEAL = "circle_reveal"
    ZOOM_FLASH = "zoom_flash"
    GLITCH = "glitch"
    SPIN = "spin"
    ZOOM_HEAVY = "zoom_heavy"
    LIGHT_LEAK = "light_leak"
    FREEZE_FRAME = "freeze_frame"
    FLIP_3D = "flip_3d"
    RADIAL_WIPE = "radial_wipe"
    NONE = "none"


@dataclass
class ShotInfo:
    index: int
    start_time: float
    end_time: float
    duration: float
    shot_type: ShotType

    visual_description: str = ""
    camera_movement: str = ""
    shot_size: str = ""
    composition: str = ""
    color_mood: str = ""

    subtitle_text: str = ""
    voiceover_text: str = ""

    transition_in: TransitionType = TransitionType.CUT
    emotion: str = ""
    structure_purpose: str = ""

    has_face: bool = False
    bgm_sync: bool = False
    is_empty_shot: bool = False

    # 预处理增强字段
    motion_intensity: float = 0.0          # 镜头内运动强度 [0, 1]
    color_stats: dict = field(default_factory=dict)  # HSV 统计 + 主色调
    audio_type: str = ""                   # speech / silence / music / mixed

    def to_dict(self) -> dict:
        return {
            "index": self.index,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration": self.duration,
            "shot_type": self.shot_type.value,
            "visual_description": self.visual_description,
            "camera_movement": self.camera_movement,
            "shot_size": self.shot_size,
            "composition": self.composition,
            "color_mood": self.color_mood,
            "subtitle_text": self.subtitle_text,
            "voiceover_text": self.voiceover_text,
            "transition_in": self.transition_in.value,
            "emotion": self.emotion,
            "structure_purpose": self.structure_purpose,
            "has_face": self.has_face,
            "bgm_sync": self.bgm_sync,
            "is_empty_shot": self.is_empty_shot,
            "motion_intensity": self.motion_intensity,
            "color_stats": self.color_stats,
            "audio_type": self.audio_type,
        }


@dataclass
class RhythmPoint:
    time: float
    intensity: float
    avg_shot_duration: float = 0
    note: str = ""

    def to_dict(self) -> dict:
        return {
            "time": self.time,
            "intensity": self.intensity,
            "avg_shot_duration": self.avg_shot_duration,
            "note": self.note,
        }


@dataclass
class SubtitleStyle:
    font_family: str = ""
    font_size: int = 0
    color: str = ""
    stroke_color: str = ""
    stroke_width: int = 0
    shadow: bool = False
    bg_color: Optional[str] = None
    background_style: str = "none"
    position: str = "bottom"
    animation: str = "none"
    typing_speed: float = 0
    max_chars_per_line: int = 15
    line_spacing: float = 1.2

    def to_dict(self) -> dict:
        return {
            "font_family": self.font_family,
            "font_size": self.font_size,
            "color": self.color,
            "stroke_color": self.stroke_color,
            "stroke_width": self.stroke_width,
            "shadow": self.shadow,
            "bg_color": self.bg_color,
            "background_style": self.background_style,
            "position": self.position,
            "animation": self.animation,
            "typing_speed": self.typing_speed,
            "max_chars_per_line": self.max_chars_per_line,
            "line_spacing": self.line_spacing,
        }


@dataclass
class PackagingStyle:
    subtitle_style: SubtitleStyle = field(default_factory=SubtitleStyle)
    title_card_style: str = ""
    text_card_background: str = ""
    text_card_font: str = ""
    preferred_transitions: list[str] = field(default_factory=list)
    transition_frequency: str = "moderate"
    color_grade: str = ""
    filter_style: str = ""
    visual_mood: str = ""
    emphasis_elements: list[str] = field(default_factory=list)
    sticker_types: list[str] = field(default_factory=list)
    color_palette: list[str] = field(default_factory=list)
    default_ken_burns: str = "slow_zoom_in"

    def to_dict(self) -> dict:
        return {
            "subtitle_style": self.subtitle_style.to_dict(),
            "title_card_style": self.title_card_style,
            "text_card_background": self.text_card_background,
            "text_card_font": self.text_card_font,
            "preferred_transitions": self.preferred_transitions,
            "transition_frequency": self.transition_frequency,
            "color_grade": self.color_grade,
            "filter_style": self.filter_style,
            "visual_mood": self.visual_mood,
            "emphasis_elements": self.emphasis_elements,
            "sticker_types": self.sticker_types,
            "color_palette": self.color_palette,
            "default_ken_burns": self.default_ken_burns,
        }


@dataclass
class BGMInfo:
    style: str = ""
    bpm: int = 0
    mood: str = ""
    beat_points: list[float] = field(default_factory=list)
    role: str = "background"
    reference_track: str = ""

    def to_dict(self) -> dict:
        return {
            "style": self.style,
            "bpm": self.bpm,
            "mood": self.mood,
            "beat_points": self.beat_points,
            "role": self.role,
            "reference_track": self.reference_track,
        }


@dataclass
class VlogMeta:
    narrative_type: str = ""
    structure_type: str = ""
    persona_type: str = ""
    persona_ratio: float = 0
    hook_method: str = ""
    hook_detail: str = ""
    empty_shot_count: int = 0
    empty_shot_ratio: float = 0
    emotion_arc: list[dict] = field(default_factory=list)
    overall_emotion: str = ""
    key_techniques: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "narrative_type": self.narrative_type,
            "structure_type": self.structure_type,
            "persona_type": self.persona_type,
            "persona_ratio": self.persona_ratio,
            "hook_method": self.hook_method,
            "hook_detail": self.hook_detail,
            "empty_shot_count": self.empty_shot_count,
            "empty_shot_ratio": self.empty_shot_ratio,
            "emotion_arc": self.emotion_arc,
            "overall_emotion": self.overall_emotion,
            "key_techniques": self.key_techniques,
        }


@dataclass
class VideoStructure:
    source_id: str = ""
    source_path: str = ""
    duration: float = 0
    resolution: tuple[int, int] = (1080, 1920)
    aspect_ratio: str = "9:16"
    shots: list[ShotInfo] = field(default_factory=list)
    script_blocks: list[dict] = field(default_factory=list)
    rhythm_curve: list[RhythmPoint] = field(default_factory=list)

    # 旧版兼容字段
    video_path: str = ""
    width: int = 0
    height: int = 0
    shot_count: int = 0
    rhythm_points: list[RhythmPoint] = field(default_factory=list)
    rhythm_pattern: str = ""
    climax_position_percent: float = 0
    front_3s_shot_count: int = 0
    estimated_bpm_range: str = ""
    bgm_style_guess: str = ""

    packaging: PackagingStyle = field(default_factory=PackagingStyle)
    bgm: BGMInfo = field(default_factory=BGMInfo)
    vlog_meta: VlogMeta = field(default_factory=VlogMeta)

    # ===== 音频全轨分析 =====
    audio_analysis: dict = field(default_factory=dict)
    # 结构: {"bpm": 120, "energy_curve": [...], "mood_segments": [...],
    #        "climax_points": [...], "audio_video_match_pattern": "...",
    #        "overall_mood": "...", "extracted_path": "..."}

    transcript: str = ""
    full_transcript: str = ""
    overall_summary: str = ""
    structure_summary: str = ""
    hook_summary: str = ""
    raw_analysis: str = ""
    key_techniques: list[str] = field(default_factory=list)

    # ===== 结构基因（Reference-guided 迁移的核心输入） =====
    # 与 VideoStructure（记录原片内容）互补：gene 只表达"结构功能"。
    gene: Optional[StructureGene] = None

    @property
    def _shot_count(self) -> int:
        return len(self.shots)

    def __post_init__(self):
        if self.video_path and not self.source_path:
            self.source_path = self.video_path
        if not self.source_id and self.source_path:
            from pathlib import Path
            self.source_id = str(Path(self.source_path).stem)
        if self.width == 0 and len(self.resolution) == 2:
            self.width, self.height = self.resolution
        if self.shot_count == 0:
            self.shot_count = len(self.shots)

    def to_dict(self) -> dict:
        return {
            "source_id": self.source_id,
            "source_path": self.source_path,
            "duration": self.duration,
            "resolution": list(self.resolution),
            "aspect_ratio": self.aspect_ratio,
            "shot_count": len(self.shots),
            "shots": [s.to_dict() for s in self.shots],
            "script_blocks": self.script_blocks,
            "rhythm_curve": [rp.to_dict() for rp in self.rhythm_curve],
            "packaging": self.packaging.to_dict(),
            "bgm": self.bgm.to_dict(),
            "vlog_meta": self.vlog_meta.to_dict(),
            "transcript": self.transcript,
            "full_transcript": self.full_transcript,
            "overall_summary": self.overall_summary,
            "structure_summary": self.structure_summary,
            "hook_summary": self.hook_summary,
            "key_techniques": self.key_techniques,
            "audio_analysis": self.audio_analysis,
            "raw_analysis": self.raw_analysis,
            "gene": self.gene.to_dict() if self.gene else {},
        }
