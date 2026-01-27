import logging
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for WebSocket compatibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes first (takes priority over static files)
app.include_router(endpoints.router, prefix="/api")

# Determine frontend path - use environment variable or default
# In Docker: /app/frontend/out
# In development: relative to this file
FRONTEND_OUT_PATH = os.environ.get(
    "FRONTEND_PATH",
    str(Path(__file__).parent.parent.parent / "frontend" / "out")
)
frontend_path = Path(FRONTEND_OUT_PATH)

logger.info(f"Frontend path configured as: {frontend_path}")
logger.info(f"Frontend path exists: {frontend_path.exists()}")


@app.on_event("startup")
async def startup_event():
    """Initialize application on startup."""
    logger.info("=== DOWNVID API Starting ===")
    
    # Check FFmpeg availability
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
            logger.warning("⚠ FFmpeg could not be installed.")
    
    # Check frontend static files
    if frontend_path.exists():
        logger.info(f"✓ Frontend static files found at: {frontend_path}")
        # List contents for debugging
        try:
            contents = list(frontend_path.iterdir())
            logger.info(f"  Contents: {[c.name for c in contents[:10]]}")
        except Exception as e:
            logger.warning(f"  Could not list contents: {e}")
    else:
        logger.warning(f"⚠ Frontend static files NOT found at: {frontend_path}")


@app.get("/")
async def serve_index():
    """Serve the frontend index.html for root path."""
    index_file = frontend_path / "index.html"
    
    logger.info(f"Serving root path, looking for: {index_file}")
    
    if index_file.exists():
        logger.info("Serving index.html")
        return FileResponse(index_file, media_type="text/html")
    
    # Fallback with helpful debug info
    logger.warning(f"index.html not found at {index_file}")
    return {
        "message": "DOWNVID API Running",
        "status": "ok",
        "frontend": "not_found",
        "expected_path": str(index_file),
        "frontend_dir_exists": frontend_path.exists()
    }


# Mount frontend static files if they exist
if frontend_path.exists():
    logger.info("Mounting frontend static files...")
    
    # Mount _next directory for Next.js assets
    next_static = frontend_path / "_next"
    if next_static.exists():
        app.mount("/_next", StaticFiles(directory=str(next_static)), name="next-static")
        logger.info(f"  Mounted /_next from {next_static}")
    
    # Mount root for other static files (but don't override API routes)
    # Using html=True enables serving index.html for directory requests
    app.mount("/static", StaticFiles(directory=str(frontend_path)), name="frontend-static")
    logger.info(f"  Mounted /static from {frontend_path}")
else:
    logger.warning("Frontend path does not exist - static files not mounted")
