"""
Grok LLM Service
Generate humorous commentary from vision descriptions
"""
from xai_sdk import Client
from xai_sdk.chat import system, user
import os


class LlmService:
    def __init__(self):
        """Initialize Grok client (stateless)"""
        self._client = Client(api_key=os.getenv("XAI_API_KEY"), timeout=3600)
        self._model = "grok-4-fast"
        self._system_prompt = (
            "You are a live sports commentator providing real-time commentary. "
            "Be passionate, enthusiastic, humorous, and sarcastic. "
            "Keep responses super concise in ONLY ONE sentence for real-time delivery."
        )

    async def generate_comment(self, description: str) -> str:
        """
        Generate commentary from vision description

        Args:
            description: Text description of current frame

        Returns:
            str: Commentary text for TTS
        """
        chat = self._client.chat.create(model=self._model)
        chat.append(system(self._system_prompt))
        chat.append(user(f"Describe what's happening: {description}"))

        response = chat.sample()
        return response.content.strip()
