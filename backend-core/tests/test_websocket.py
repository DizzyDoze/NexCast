"""
Test WebSocket endpoint with full pipeline
Run: python test_websocket.py (make sure server is running)
"""
import asyncio
import json
import base64
from pathlib import Path
from dotenv import load_dotenv
import websockets

# Load environment variables
env_path = Path(__file__).parent / "app" / "config" / ".env"
load_dotenv(env_path)


async def test_websocket():
    """Test WebSocket connection and frame processing"""
    uri = "ws://localhost:8000/ws/123"

    print("=" * 60)
    print("WebSocket Pipeline Test")
    print("=" * 60)

    try:
        async with websockets.connect(uri) as ws:
            print("\n✓ Connected to WebSocket")

            # Step 1: Send initial preferences
            print("\n[1] Sending preferences...")
            await ws.send(json.dumps({
                "type": "init",
                "preferences": {
                    "speaking_rate": 1.0,
                    "pitch": 0.0,
                    "volume": 100
                }
            }))

            # Wait for ready response
            response = await ws.recv()
            response_data = json.loads(response)
            if response_data.get("type") == "ready":
                print(f"✓ Server ready: {response}")
            else:
                print(f"✗ Unexpected response: {response}")
                return False

            # Step 2: Send test frame
            print("\n[2] Sending test frame...")
            # Create a simple 1x1 red JPEG
            test_frame_bytes = (
                b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
                b'\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c'
                b'\x14\x0c\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c'
                b'\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x0b\x08\x00'
                b'\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00'
                b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xff\xc4\x00\x14\x10\x01\x00'
                b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00'
                b'\x08\x01\x01\x00\x00?\x00\x7f\x00\xff\xd9'
            )
            test_frame = base64.b64encode(test_frame_bytes).decode()

            await ws.send(json.dumps({
                "type": "frame",
                "frame": test_frame
            }))
            print("✓ Frame sent")

            # Step 3: Wait for audio response
            print("\n[3] Waiting for audio response...")
            print("    (This may take 5-10 seconds for full pipeline)")

            audio_response = await asyncio.wait_for(ws.recv(), timeout=30)
            data = json.loads(audio_response)

            if data.get("type") != "audio":
                print(f"✗ Unexpected response type: {data.get('type')}")
                return False

            print(f"✓ Received audio response")
            print(f"  - Base64 length: {len(data['audio'])} chars")

            # Step 4: Decode and save audio
            print("\n[4] Saving audio...")
            audio_bytes = base64.b64decode(data['audio'])
            output_file = "ws_test_output.mp3"
            with open(output_file, "wb") as f:
                f.write(audio_bytes)
            print(f"✓ Saved to {output_file}")
            print(f"  - Audio size: {len(audio_bytes)} bytes")
            print(f"  - Play the file to verify commentary!")

            print("\n" + "=" * 60)
            print("✓ WebSocket Test PASSED")
            print("=" * 60)
            return True

    except websockets.exceptions.WebSocketException as e:
        print(f"\n✗ WebSocket Error: {e}")
        print("   Make sure the server is running: uvicorn app.main:app --reload")
        return False
    except asyncio.TimeoutError:
        print("\n✗ Timeout waiting for audio response")
        print("   The pipeline may be taking too long or encountered an error")
        return False
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    success = await test_websocket()
    return success


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)
