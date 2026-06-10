import logging

from agents.base import BaseAgent
from prompts.knowledge_prompts import (
    build_knowledge_extract_prompt,
    build_knowledge_retrieve_prompt,
)
from models.knowledge import KnowledgeEntry, KnowledgeType

logger = logging.getLogger(__name__)


class KnowledgeAgent(BaseAgent):
    async def extract_knowledge(
        self, video_structure_json: str, category: str, duration: float
    ) -> list[KnowledgeEntry]:
        prompt = build_knowledge_extract_prompt(
            video_structure_json, category, duration
        )
        result = await self.llm.chat(
            prompt, system="你是一位Vlog内容研究专家。请严格按照JSON格式输出。",
            response_format="json",
        )
        data = self.llm.parse_json(result)

        entries = []
        for i, entry_data in enumerate(data.get("knowledge_entries", [])):
            entry = KnowledgeEntry(
                id=f"k_{i}",
                type=KnowledgeType(entry_data["type"]),
                title=entry_data["title"],
                content=entry_data["content"],
                structured_data=entry_data.get("structured_data", {}),
                tags=entry_data.get("tags", []),
                applicable_vlog_types=entry_data.get("applicable_vlog_types", []),
                best_when=entry_data.get("best_when", ""),
                confidence=entry_data.get("confidence", 0.0),
                source_summary=entry_data.get("source_summary", ""),
            )
            entries.append(entry)

        return entries

    async def retrieve_knowledge(
        self,
        target_topic: str,
        target_info: str,
        material_summary: str,
        user_preferences: str,
        candidate_entries: str,
    ) -> dict:
        prompt = build_knowledge_retrieve_prompt(
            target_topic, target_info, material_summary,
            user_preferences, candidate_entries,
        )
        result = await self.llm.chat(
            prompt, system="你是一位Vlog创作顾问。请严格按照JSON格式输出。",
            response_format="json",
        )
        return self.llm.parse_json(result)
