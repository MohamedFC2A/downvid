"""
FFmpeg Installation Script for DOWNVID

Downloads and extracts FFmpeg static build for Windows from gyan.dev.
Installs ffmpeg.exe and ffprobe.exe to backend/bin/
"""

import os
import sys
import zipfile
import urllib.request
import shutil
from pathlib import Path

# FFmpeg essentials build from gyan.dev (smaller, ~30MB)
FFMPEG_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
FFMPEG_FILENAME = "ffmpeg-release-essentials.zip"


def get_script_dir() -> Path:
    """Get the directory where this script is located."""
    return Path(__file__).parent.resolve()


def get_backend_dir() -> Path:
    """Get the backend directory (parent of scripts)."""
    return get_script_dir().parent


def get_bin_dir() -> Path:
    """Get the bin directory where FFmpeg will be installed."""
    return get_backend_dir() / "bin"


def download_with_progress(url: str, dest_path: Path) -> None:
    """Download a file with progress display."""
    print(f"Downloading FFmpeg from:\n  {url}")
    print(f"Saving to:\n  {dest_path}")
    
    def reporthook(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            percent = min(100, (downloaded / total_size) * 100)
            downloaded_mb = downloaded / (1024 * 1024)
            total_mb = total_size / (1024 * 1024)
            sys.stdout.write(f"\r  Progress: {percent:.1f}% ({downloaded_mb:.1f}/{total_mb:.1f} MB)")
            sys.stdout.flush()
    
    urllib.request.urlretrieve(url, dest_path, reporthook)
    print()  # Newline after progress


def extract_ffmpeg(zip_path: Path, bin_dir: Path) -> bool:
    """
    Extract ffmpeg.exe and ffprobe.exe from the downloaded zip.
    Returns True if successful.
    """
    print(f"Extracting FFmpeg to: {bin_dir}")
    
    bin_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            # Find the bin folder inside the archive
            # Structure is usually: ffmpeg-X.X-essentials_build/bin/ffmpeg.exe
            file_list = zf.namelist()
            
            ffmpeg_found = False
            ffprobe_found = False
            
            for file_path in file_list:
                filename = os.path.basename(file_path)
                
                if filename == "ffmpeg.exe":
                    print(f"  Found: {file_path}")
                    with zf.open(file_path) as src:
                        with open(bin_dir / "ffmpeg.exe", 'wb') as dst:
                            shutil.copyfileobj(src, dst)
                    ffmpeg_found = True
                
                elif filename == "ffprobe.exe":
                    print(f"  Found: {file_path}")
                    with zf.open(file_path) as src:
                        with open(bin_dir / "ffprobe.exe", 'wb') as dst:
                            shutil.copyfileobj(src, dst)
                    ffprobe_found = True
                
                if ffmpeg_found and ffprobe_found:
                    break
            
            if not ffmpeg_found:
                print("ERROR: ffmpeg.exe not found in archive!")
                return False
            
            if not ffprobe_found:
                print("WARNING: ffprobe.exe not found (optional)")
            
            return True
            
    except zipfile.BadZipFile:
        print("ERROR: Downloaded file is not a valid zip archive!")
        return False


def install_ffmpeg() -> bool:
    """
    Main installation function.
    Returns True if FFmpeg was successfully installed.
    """
    bin_dir = get_bin_dir()
    ffmpeg_path = bin_dir / "ffmpeg.exe"
    
    # Check if already installed
    if ffmpeg_path.exists():
        print(f"FFmpeg already installed at: {ffmpeg_path}")
        return True
    
    # Create temp directory for download
    temp_dir = get_backend_dir() / "temp"
    temp_dir.mkdir(parents=True, exist_ok=True)
    zip_path = temp_dir / FFMPEG_FILENAME
    
    try:
        # Download
        download_with_progress(FFMPEG_URL, zip_path)
        
        # Extract
        if not extract_ffmpeg(zip_path, bin_dir):
            return False
        
        # Verify installation
        if ffmpeg_path.exists():
            print(f"\n✓ FFmpeg successfully installed!")
            print(f"  Location: {ffmpeg_path}")
            return True
        else:
            print("ERROR: Installation verification failed!")
            return False
            
    except urllib.error.URLError as e:
        print(f"ERROR: Failed to download FFmpeg: {e}")
        return False
    except Exception as e:
        print(f"ERROR: Installation failed: {e}")
        return False
    finally:
        # Cleanup temp files
        if zip_path.exists():
            try:
                os.remove(zip_path)
                print("  Cleaned up temporary files.")
            except:
                pass
        if temp_dir.exists() and not any(temp_dir.iterdir()):
            try:
                temp_dir.rmdir()
            except:
                pass


def main():
    """CLI entry point."""
    print("=" * 50)
    print("DOWNVID - FFmpeg Installer")
    print("=" * 50)
    print()
    
    success = install_ffmpeg()
    
    print()
    if success:
        print("Installation complete!")
        sys.exit(0)
    else:
        print("Installation failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
