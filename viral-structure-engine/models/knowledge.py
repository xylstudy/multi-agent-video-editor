from dataclasses import dataclass, field
from enum import Enum


class KnowledgeType(str, Enum):
    STRUCTURE_TEMPLATE = "structure_template"
    HOOK_TECHNIQUE = "hook_technique"
    RHYTHM_PATTERN = "rhythm_pattern"
    EMOTION_DESIGN = "emotion_design"
    PACKAGING_STYLE = "packaging_style"
    EDITING_TECHNIQUE = "editing_technique"
    TRANSITION_TYPE = "transition_type"
    EFFECT_TYPE = "effect_type"


@dataclass
class KnowledgeEntry:
    id: str = ""
    type: KnowledgeType = KnowledgeType.STRUCTURE_TEMPLATE
    title: str = ""
    content: str = ""
    structured_data: dict = field(default_factory=dict)
    tags: list[str] = field(default_factory=list)
    applicable_vlog_types: list[str] = field(default_factory=list)
    best_when: str = ""
    confidence: float = 0.0
    source_summary: str = ""
    # 溯源：这条知识是怎么提炼出来的（来源基因、prompt 版本、模型等）
    derivation: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type.value,
            "title": self.title,
            "content": self.content,
            "structured_data": self.structured_data,
            "tags": self.tags,
            "applicable_vlog_types": self.applicable_vlog_types,
            "best_when": self.best_when,
            "confidence": self.confidence,
            "source_summary": self.source_summary,
            "derivation": self.derivation,
        }
