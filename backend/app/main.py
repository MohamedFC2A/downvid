import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/")
def read_root():
    return {"message": "DOWNVID API Running", "status": "ok"}

