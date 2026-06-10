import logging
from typing import Optional

logger = logging.getLogger(__name__)


class KnowledgeIndex:
    def __init__(self):
        self.index = {}

    def add_entry(self, entry_id: str, tags: list[str], content: str):
        self.index[entry_id] = {
            "tags": tags,
            "content": content,
        }

    def search_by_tags(self, tags: list[str]) -> list[str]:
        results = []
        for entry_id, data in self.index.items():
            if any(t in data["tags"] for t in tags):
                results.append(entry_id)
        return results

    def remove_entry(self, entry_id: str):
        self.index.pop(entry_id, None)

    def clear(self):
        self.index.clear()
