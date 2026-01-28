import yt_dlp
import os
import asyncio
import logging
from typing import Callable, Optional, Dict
from pathlib import Path
from app.services import ffmpeg_utils

logger = logging.getLogger(__name__)

class DownloadService:
    """Service for handling video downloads with real-time progress tracking"""
    
    def __init__(self, download_dir: str = "./downloads"):
        self.download_dir = Path(download_dir)
        self.download_dir.mkdir(exist_ok=True)
        self.progress_callback: Optional[Callable] = None
    
    def set_progress_callback(self, callback: Callable):
        """Set callback function for progress updates"""
        self.progress_callback = callback
    
    def _progress_hook(self, d: Dict):
        """Hook function called by yt-dlp for progress updates"""
        if not self.progress_callback:
            return
        
        if d['status'] == 'downloading':
            # Extract progress information
            downloaded = d.get('downloaded_bytes', 0)
            total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
            speed = d.get('speed', 0)
            eta = d.get('eta', 0)
            
            # Calculate percentage
            percentage = 0
            if total > 0:
                percentage = (downloaded / total) * 100
            
            # Format speed
            speed_str = self._format_bytes(speed) + '/s' if speed else 'Unknown'
            
            # Format ETA
            eta_str = self._format_time(eta) if eta else 'Unknown'
            
            # Send progress update
            asyncio.create_task(self.progress_callback({
                'type': 'progress',
                'percentage': round(percentage, 2),
                'downloaded': self._format_bytes(downloaded),
                'total': self._format_bytes(total),
                'speed': speed_str,
                'eta': eta_str,
                'status': 'downloading'
            }))
        
        elif d['status'] == 'finished':
            asyncio.create_task(self.progress_callback({
                'type': 'progress',
                'percentage': 100,
                'status': 'processing',
                'message': 'Processing and converting file...'
            }))
    
    def _format_bytes(self, bytes: float) -> str:
        """Format bytes to human readable format"""
        if bytes == 0:
            return '0 B'
        
        units = ['B', 'KB', 'MB', 'GB', 'TB']
        i = 0
        while bytes >= 1024 and i < len(units) - 1:
            bytes /= 1024
            i += 1
        
        return f'{bytes:.2f} {units[i]}'
    
    def _format_time(self, seconds: int) -> str:
        """Format seconds to human readable time"""
        if seconds < 60:
            return f'{seconds}s'
        elif seconds < 3600:
            minutes = seconds // 60
            secs = seconds % 60
            return f'{minutes}m {secs}s'
        else:
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            return f'{hours}h {minutes}m'
    
    async def download_video(
        self,
        url: str,
        format_type: str = 'mp4',
        quality: str = '1080p'
    ) -> str:
        """
        Download video with specified format and quality
        Returns the path to the downloaded file
        """
        # Map quality to yt-dlp format
        quality_map = {
            '2160p': 'bestvideo[height<=2160]+bestaudio/best[height<=2160]',
            '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
            '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
            '480p': 'bestvideo[height<=480]+bestaudio/best[height<=480]'
        }
        
        # Get FFmpeg location if available locally
        ffmpeg_opts = ffmpeg_utils.get_ydl_ffmpeg_opts()
        
        # Configure yt-dlp options
        ydl_opts = {
            'format': quality_map.get(quality, quality_map['1080p']) if format_type == 'mp4' else 'bestaudio/best',
            'outtmpl': str(self.download_dir / '%(title)s.%(ext)s'),
            'progress_hooks': [self._progress_hook],
            'quiet': False,
            'no_warnings': False,
            'nocheckcertificate': True,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            # Options to bypass YouTube restrictions - use tv_embedded which works better on cloud
            'extractor_args': {'youtube': {'player_client': ['tv_embedded', 'web']}},
            'http_headers': {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            'socket_timeout': 60,
            'retries': 5,
            'fragment_retries': 5,
            **ffmpeg_opts
        }
        
        # Add post-processor for audio-only
        if format_type == 'mp3':
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]
        
        try:
            # Download in executor to avoid blocking
            loop = asyncio.get_event_loop()
            file_path = await loop.run_in_executor(
                None,
                self._download_sync,
                url,
                ydl_opts
            )
            
            return file_path
        
        except Exception as e:
            error_msg = str(e)
            
            # Check if this is an FFmpeg-related error - try fallback
            if 'ffmpeg' in error_msg.lower() or 'merging' in error_msg.lower():
                logger.warning(f"FFmpeg error, trying fallback to 'best' format: {error_msg}")
                
                # Fallback options: use 'best' format (no merge needed)
                fallback_opts = {
                    'format': 'best',
                    'outtmpl': str(self.download_dir / '%(title)s.%(ext)s'),
                    'progress_hooks': [self._progress_hook],
                    'quiet': False,
                    'no_warnings': False,
                    'nocheckcertificate': True,
                    'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    # Options to bypass YouTube restrictions - use tv_embedded which works better on cloud
                    'extractor_args': {'youtube': {'player_client': ['tv_embedded', 'web']}},
                    'http_headers': {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                    },
                    'socket_timeout': 60,
                    'retries': 5,
                    'fragment_retries': 5,
                    **ffmpeg_opts
                }
                
                try:
                    loop = asyncio.get_event_loop()
                    file_path = await loop.run_in_executor(
                        None,
                        self._download_sync,
                        url,
                        fallback_opts
                    )
                    logger.info("Fallback download succeeded")
                    return file_path
                except Exception as fallback_error:
                    logger.error(f"Fallback download also failed: {fallback_error}")
                    raise Exception(f"Download failed: {fallback_error}")
            
            raise Exception(f"Download failed: {error_msg}")
    
    def _download_sync(self, url: str, opts: dict) -> str:
        """Synchronous download function for executor"""
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            # Get the downloaded file path
            if 'requested_downloads' in info:
                return info['requested_downloads'][0]['filepath']
            else:
                # Fallback to constructing the path
                filename = ydl.prepare_filename(info)
                return filename
    
    async def get_video_info(self, url: str) -> dict:
        """Get detailed video information including subtitles and transcript"""
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'writesubtitles': False,
            'writeautomaticsub': False,
            'nocheckcertificate': True,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            # Options to bypass YouTube restrictions - use tv_embedded which works better on cloud
            'extractor_args': {'youtube': {'player_client': ['tv_embedded', 'web']}},
            'http_headers': {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            'socket_timeout': 60,
            'retries': 5,
        }
        
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(
            None,
            self._extract_info_sync,
            url,
            ydl_opts
        )
        
        return {
            'title': info.get('title', ''),
            'description': info.get('description', ''),
            'tags': info.get('tags', []),
            'duration': info.get('duration', 0),
            'view_count': info.get('view_count', 0),
            'like_count': info.get('like_count', 0),
            'upload_date': info.get('upload_date', ''),
            'thumbnail': info.get('thumbnail', ''),
            'subtitles': bool(info.get('subtitles')),
            'automatic_captions': bool(info.get('automatic_captions')),
        }
    
    def _extract_info_sync(self, url: str, opts: dict) -> dict:
        """Synchronous info extraction for executor"""
        with yt_dlp.YoutubeDL(opts) as ydl:
            return ydl.extract_info(url, download=False)
