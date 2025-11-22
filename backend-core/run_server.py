"""
Run uvicorn with custom WebSocket settings
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        ws_ping_interval=None,  # Disable ping
        ws_ping_timeout=None,   # Disable timeout
        ws_max_size=16777216    # 16MB max message size
    )
