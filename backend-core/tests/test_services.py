"""
Test individual services (Vision, LLM, TTS)
Run: python test_services.py
"""
import asyncio
import base64
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent / "app" / "config" / ".env"
load_dotenv(env_path)

from app.services.vision import VisionService
from app.services.llm import LlmService
from app.services.tts import TTSService


async def test_vision():
    """Test Vision service with a sample image"""
    print("\n=== Testing Vision Service ===")
    service = VisionService()

    # Create a simple test image (minimal valid JPEG)
    # This is a 1x1 red pixel JPEG
    test_image_bytes = (
        b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
        b'\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c'
        b'\x14\x0c\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c'
        b'\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x0b\x08\x00'
        b'\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00'
        b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xff\xc4\x00\x14\x10\x01\x00'
        b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00'
        b'\x08\x01\x01\x00\x00?\x00\x7f\x00\xff\xd9'
    )
    test_image = base64.b64encode(test_image_bytes).decode()

    try:
        result = await service.analyze_with_context(test_image, "test_session_1")
        print(f"✓ Description: {result}")
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


async def test_llm():
    """Test LLM service"""
    print("\n=== Testing LLM Service ===")
    service = LlmService()

    try:
        comment = await service.generate_comment("Player is moving forward on the map, aiming at an enemy")
        print(f"✓ Commentary: {comment}")
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


async def test_tts():
    """Test TTS service"""
    print("\n=== Testing TTS Service ===")
    service = TTSService()

    try:
        audio = await service.synthesize(
            text="This is a test commentary! The player is making an incredible move!",
            speaking_rate=1.0,
            pitch=0.0,
            volume=100
        )
        print(f"✓ Audio generated: {len(audio)} bytes")

        # Save to file for manual verification
        with open("test_output.mp3", "wb") as f:
            f.write(audio)
        print(f"✓ Saved to test_output.mp3 (play to verify)")
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


async def main():
    print("=" * 60)
    print("NexCast Service Tests")
    print("=" * 60)

    results = []

    # Test each service
    results.append(("Vision", await test_vision()))
    results.append(("LLM", await test_llm()))
    results.append(("TTS", await test_tts()))

    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{name:20} {status}")

    all_passed = all(r[1] for r in results)
    print("=" * 60)
    print(f"\nOverall: {'✓ ALL TESTS PASSED' if all_passed else '✗ SOME TESTS FAILED'}\n")

    return all_passed


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)
