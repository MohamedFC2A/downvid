"""
FFmpeg Utilities for DOWNVID

Provides functions to detect, locate, and ensure FFmpeg availability.
"""

import os
import shutil
import subprocess
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def get_backend_dir() -> Path:
    """Get the backend directory."""
    # This file is at backend/app/services/ffmpeg_utils.py
    return Path(__file__).parent.parent.parent.resolve()


def get_local_ffmpeg_path() -> Path:
    """Get the path to the local FFmpeg binary in backend/bin/."""
    return get_backend_dir() / "bin" / "ffmpeg.exe"


def get_local_ffprobe_path() -> Path:
    """Get the path to the local FFprobe binary in backend/bin/."""
    return get_backend_dir() / "bin" / "ffprobe.exe"


def is_ffmpeg_in_path() -> bool:
    """Check if FFmpeg is available in system PATH."""
    return shutil.which("ffmpeg") is not None


def is_local_ffmpeg_installed() -> bool:
    """Check if FFmpeg is installed locally in backend/bin/."""
    return get_local_ffmpeg_path().exists()


def is_ffmpeg_available() -> bool:
    """Check if FFmpeg is available (either in PATH or locally)."""
    return is_ffmpeg_in_path() or is_local_ffmpeg_installed()


def get_ffmpeg_location() -> Optional[str]:
    """
    Get the FFmpeg location to use.
    
    Returns:
        - None if FFmpeg is in system PATH (yt-dlp will find it automatically)
        - Path to backend/bin/ directory if using local installation
        - None if FFmpeg is not available anywhere
    """
    if is_ffmpeg_in_path():
        logger.info("FFmpeg found in system PATH")
        return None  # yt-dlp will find it automatically
    
    local_path = get_local_ffmpeg_path()
    if local_path.exists():
        # Return the directory containing ffmpeg, not the exe itself
        location = str(local_path.parent)
        logger.info(f"Using local FFmpeg at: {location}")
        return location
    
    logger.warning("FFmpeg not found in PATH or locally!")
    return None


def verify_ffmpeg_works(ffmpeg_path: Optional[str] = None) -> bool:
    """
    Verify that FFmpeg actually works by running it.
    
    Args:
        ffmpeg_path: Optional path to FFmpeg directory. If None, uses system PATH.
    
    Returns:
        True if FFmpeg runs successfully.
    """
    try:
        if ffmpeg_path:
            exe_path = Path(ffmpeg_path) / "ffmpeg.exe"
            cmd = [str(exe_path), "-version"]
        else:
            cmd = ["ffmpeg", "-version"]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return False


def install_ffmpeg_if_needed() -> bool:
    """
    Install FFmpeg locally if it's not available.
    
    Returns:
        True if FFmpeg is available after this call.
    """
    if is_ffmpeg_available():
        return True
    
    logger.info("FFmpeg not found. Attempting to install...")
    
    try:
        # Import and run the install script
        from backend.scripts import install_ffmpeg
        success = install_ffmpeg.install_ffmpeg()
        
        if success:
            logger.info("FFmpeg installed successfully!")
            return True
        else:
            logger.error("FFmpeg installation failed!")
            return False
            
    except ImportError:
        # Try alternative import path
        try:
            import sys
            scripts_dir = get_backend_dir() / "scripts"
            sys.path.insert(0, str(scripts_dir))
            import install_ffmpeg
            success = install_ffmpeg.install_ffmpeg()
            return success
        except Exception as e:
            logger.error(f"Failed to import install script: {e}")
            return False
    except Exception as e:
        logger.error(f"FFmpeg installation error: {e}")
        return False


def ensure_ffmpeg_available() -> tuple[bool, Optional[str]]:
    """
    Ensure FFmpeg is available, installing if necessary.
    
    Returns:
        Tuple of (is_available, ffmpeg_location).
        - ffmpeg_location is None if in system PATH
        - ffmpeg_location is the directory path if using local install
    """
    # First check if already available
    if is_ffmpeg_in_path():
        return True, None
    
    if is_local_ffmpeg_installed():
        return True, str(get_local_ffmpeg_path().parent)
    
    # Try to install
    if install_ffmpeg_if_needed():
        if is_local_ffmpeg_installed():
            return True, str(get_local_ffmpeg_path().parent)
    
    return False, None


def get_ydl_ffmpeg_opts() -> dict:
    """
    Get yt-dlp options dict with ffmpeg_location configured.
    
    Returns:
        Dict to merge into ydl_opts. Empty if FFmpeg is in PATH.
    """
    location = get_ffmpeg_location()
    if location:
        return {'ffmpeg_location': location}
    return {}
