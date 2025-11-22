"""
NexCast Backend API
FastAPI server with WebSocket for live commentary
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes.ws_stream import router as ws_router

# Load environment variables
env_path = Path(__file__).parent / "config" / ".env"
load_dotenv(env_path)

app = FastAPI(title="NexCast API", version="1.0.0")

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Include WebSocket router
app.include_router(ws_router)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "nexcast-api"}
