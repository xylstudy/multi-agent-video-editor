import json
import logging
from pathlib import Path
from typing import Optional

from config import settings
from models.knowledge import KnowledgeEntry, KnowledgeType
from knowledge.index import KnowledgeIndex

logger = logging.getLogger(__name__)


class KnowledgeStore:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or settings.KNOWLEDGE_DB_DIR / "knowledge.json"
        self.index = KnowledgeIndex()
        self._entries: dict[str, KnowledgeEntry] = {}
        self._load()

    def add_entry(self, entry: KnowledgeEntry):
        entry_id = entry.id or f"k_{len(self._entries)}"
        entry.id = entry_id
        self._entries[entry_id] = entry
        self.index.add_entry(entry_id, entry.tags, entry.content)
        self._save()

    def get_entry(self, entry_id: str) -> Optional[KnowledgeEntry]:
        return self._entries.get(entry_id)

    def get_all_entries(self) -> list[KnowledgeEntry]:
        return list(self._entries.values())

    def search_by_tags(self, tags: list[str]) -> list[KnowledgeEntry]:
        entry_ids = self.index.search_by_tags(tags)
        return [self._entries[eid] for eid in entry_ids if eid in self._entries]

    def search_by_type(self, ktype: KnowledgeType) -> list[KnowledgeEntry]:
        return [e for e in self._entries.values() if e.type == ktype]

    def remove_entry(self, entry_id: str):
        self._entries.pop(entry_id, None)
        self.index.remove_entry(entry_id)
        self._save()

    def count(self) -> int:
        return len(self._entries)

    def _save(self):
        data = [
            entry.to_dict() for entry in self._entries.values()
        ]
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _load(self):
        if self.db_path.exists():
            try:
                data = json.loads(self.db_path.read_text(encoding="utf-8"))
                for item in data:
                    entry = KnowledgeEntry(
                        id=item.get("id", ""),
                        type=KnowledgeType(item.get("type", "structure_template")),
                        title=item.get("title", ""),
                        content=item.get("content", ""),
                        structured_data=item.get("structured_data", {}),
                        tags=item.get("tags", []),
                        applicable_vlog_types=item.get("applicable_vlog_types", []),
                        best_when=item.get("best_when", ""),
                        confidence=item.get("confidence", 0.0),
                        source_summary=item.get("source_summary", ""),
                    )
                    self._entries[entry.id] = entry
                    self.index.add_entry(entry.id, entry.tags, entry.content)
            except Exception as e:
                logger.warning(f"知识库加载失败: {e}")
