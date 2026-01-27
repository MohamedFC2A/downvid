import logging
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api import endpoints
from app.core.config import settings
from app.services import ffmpeg_utils

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.PROJECT_NAME)

# CORS configuration for production
# Allow both local development and Fly.io deployment
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://downvid.fly.dev",
    "https://*.fly.dev",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for WebSocket compatibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes first (takes priority over static files)
app.include_router(endpoints.router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    """Check FFmpeg availability on startup."""
    logger.info("Checking FFmpeg availability...")
    
    if ffmpeg_utils.is_ffmpeg_in_path():
        logger.info("✓ FFmpeg found in system PATH")
    elif ffmpeg_utils.is_local_ffmpeg_installed():
        logger.info(f"✓ FFmpeg found locally at: {ffmpeg_utils.get_local_ffmpeg_path()}")
    else:
        logger.warning("⚠ FFmpeg not found! Attempting auto-installation...")
        success = ffmpeg_utils.install_ffmpeg_if_needed()
        if success:
            logger.info("✓ FFmpeg installed successfully!")
        else:
            logger.warning(
                "⚠ FFmpeg could not be installed. "
                "Downloads requiring format merging will fall back to lower quality. "
                "For best quality, install FFmpeg manually: https://ffmpeg.org/download.html"
            )
    
    # Check if frontend static files exist
    frontend_path = Path(__file__).parent.parent.parent / "frontend" / "out"
    if frontend_path.exists():
        logger.info(f"✓ Frontend static files found at: {frontend_path}")
    else:
        logger.warning(f"⚠ Frontend static files not found at: {frontend_path}")


@app.get("/")
async def serve_index():
    """Serve the frontend index.html for root path."""
    frontend_path = Path(__file__).parent.parent.parent / "frontend" / "out"
    index_file = frontend_path / "index.html"
    
    if index_file.exists():
        return FileResponse(index_file, media_type="text/html")
    
    # Fallback to API response if frontend not built
    return {"message": "DOWNVID API Running", "status": "ok", "frontend": "not_built"}


# Mount frontend static files AFTER API routes
# This serves the Next.js static export from /frontend/out
frontend_path = Path(__file__).parent.parent.parent / "frontend" / "out"
if frontend_path.exists():
    # Serve static assets (CSS, JS, images)
    app.mount("/_next", StaticFiles(directory=str(frontend_path / "_next")), name="next-static")
    
    # Serve other static files from public folder
    public_path = frontend_path
    app.mount("/", StaticFiles(directory=str(public_path), html=True), name="frontend")
