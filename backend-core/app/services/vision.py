import base64
import os
from collections import deque

from google import genai
from google.genai import types


class VisionService:
    def __init__(self):
        self._client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        self._model = "gemini-2.5-flash"
        self._session_history = {}      # {session_id: deque([desc1, desc2, desc3])}

    async def analyze_with_context(self, frame_base64, session_id):
        # Empty queue if no hitory found
        history = self._session_history.get(session_id, deque(maxlen=3))
        context = "\n".join(f"T-{i+1}: {d}" for i, d in enumerate(reversed(history)))

        # Input: Current Frame + Historical Context
        prompt = (
            f"Previous frames:\n{context}\n\nDescribe what's happening NOW in ONE short sentence. Note any changes."
            if context
            else "Describe this image in ONE short sentence."
        )

        response = await self._client.aio.models.generate_content(
            model=self._model,
            contents=[
                types.Part.from_bytes(data=base64.b64decode(frame_base64), mime_type="image/jpeg"),
                prompt
            ],
            config=types.GenerateContentConfig(temperature=0.3)
        )

        desc = response.text.strip()
        history.append(desc)
        self._session_history[session_id] = history
        return desc
