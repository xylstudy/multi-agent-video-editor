import json
import logging
from typing import Optional

from agents.knowledge_agent import KnowledgeAgent
from knowledge.store import KnowledgeStore

logger = logging.getLogger(__name__)


class KnowledgeExtractor:
    def __init__(self, store: Optional[KnowledgeStore] = None):
        self.agent = KnowledgeAgent()
        self.store = store or KnowledgeStore()

    async def extract_from_structure(
        self,
        video_structure_json: str,
        category: str = "vlog",
        duration: float = 0.0,
    ) -> int:
        entries = await self.agent.extract_knowledge(
            video_structure_json, category, duration,
        )
        for entry in entries:
            self.store.add_entry(entry)
        logger.info(f"从分析结果中提炼了 {len(entries)} 条知识")
        return len(entries)
