import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api import endpoints
from app.core.config import settings
from app.services import ffmpeg_utils
from app.services.yt_dlp_cli import is_serverless_runtime

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

# Determine frontend path - use Settings/env (container-friendly)
frontend_path = Path(settings.FRONTEND_PATH)

logger.info(f"Frontend path configured as: {frontend_path}")
logger.info(f"Frontend path exists: {frontend_path.exists()}")

downloads_path = Path(settings.DOWNLOADS_DIR)
logger.info(f"Downloads path configured as: {downloads_path}")


@app.on_event("startup")
async def startup_event():
    """Initialize application on startup."""
    logger.info("=== DOWNVID API Starting ===")

    if is_serverless_runtime():
        logger.warning("Serverless runtime detected - skipping FFmpeg checks/installation.")
        return

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

    # Ensure downloads directory exists
    try:
        downloads_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"✓ Downloads directory ready at: {downloads_path}")
    except Exception as e:
        logger.warning(f"⚠ Could not create downloads directory at {downloads_path}: {e}")
    
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

# Mount frontend static export at the web root (if present).
# This serves `/`, `/tool`, `/_next/*`, etc. while `/api/*` remains handled by the router above.
if frontend_path.exists():
    logger.info("Mounting frontend static files at / ...")
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
else:
    logger.warning("Frontend path does not exist - static files not mounted")

    @app.get("/")
    async def root_status():
        return {
            "message": "DOWNVID API Running",
            "status": "ok",
            "frontend": "not_found",
            "frontend_path": str(frontend_path),
        }
