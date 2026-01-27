import yt_dlp
import asyncio
import re
import os
import uuid
import logging
from typing import List, Optional
from pydantic import BaseModel
from app.api.websocket import manager
from app.services import ffmpeg_utils

logger = logging.getLogger(__name__)

class VideoFormat(BaseModel):
    format_id: str
    resolution: str  # "1080p", "720p"
    extension: str   # "mp4", "webm"
    filesize_str: str # "15MB"
    note: str        # "High Quality"

class YtDlpService:
    def _format_filesize(self, bytes_val):
        if not bytes_val: return "Unknown"
        for unit in ['B', 'KB', 'MB', 'GB']:
            if bytes_val < 1024:
                return f"{bytes_val:.1f}{unit}"
            bytes_val /= 1024
        return f"{bytes_val:.1f}TB"

    async def get_video_info(self, url: str):
        loop = asyncio.get_running_loop()
        ydl_opts = {'quiet': True, 'noplaylist': True}
        
        def fetch_info():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(url, download=False)

        info = await loop.run_in_executor(None, fetch_info)
        
        formats = info.get('formats', [])
        available_formats = []
        audio_formats = []
        
        # Process Video Formats
        # We want to group by resolution and find the best one (usually mp4)
        seen_res = set()
        # Sort by height desc for convenience
        formats_sorted = sorted(formats, key=lambda x: (x.get('height') or 0, x.get('tbr') or 0), reverse=True)
        
        for f in formats_sorted:
            if f.get('vcodec') != 'none' and f.get('acodec') == 'none': # Video only stream usually has better quality options
                height = f.get('height')
                if not height: continue
                
                res_str = f"{height}p"
                if res_str in seen_res: continue
                
                valid_ext = f.get('ext') in ['mp4', 'webm']
                if not valid_ext: continue
                
                filesize = f.get('filesize') or f.get('filesize_approx')
                
                available_formats.append(VideoFormat(
                    format_id=f['format_id'],
                    resolution=res_str,
                    extension=f['ext'],
                    filesize_str=self._format_filesize(filesize),
                    note=f.get('format_note', '')
                ))
                seen_res.add(res_str)

        # Process Audio Formats
        for f in formats:
             if f.get('vcodec') == 'none' and f.get('acodec') != 'none':
                filesize = f.get('filesize') or f.get('filesize_approx')
                audio_formats.append(VideoFormat(
                    format_id=f['format_id'],
                    resolution="Audio",
                    extension=f['ext'],
                    filesize_str=self._format_filesize(filesize),
                    note=f.get('format_note', 'Audio Only')
                ))
                # Just take top 3 distinct audios? usually just want one good one.
                # Let's just return unique extensions/qualities? 
                # For now let's just grab the best audio (m4a/mp3)
        
        # Deduplicate audio by extension/quality if needed, but let's just limit to a few best ones
        # Actually for audio mode, usually 'bestaudio' is fine, but if user wants to select... 
        # let's filters for unique 'ext' + 'abr' (bitrate).
        
        # Simplified Audio: Just return distinct extensions with best bitrate
        unique_audio = {}
        for af in audio_formats:
            if af.extension not in unique_audio:
                unique_audio[af.extension] = af
        
        final_audio_formats = list(unique_audio.values())

        # Also return raw info for title etc
        return {
            "title": info.get('title'),
            "thumbnail": info.get('thumbnail'),
            "description": info.get('description'),
            "available_formats": [f.dict() for f in available_formats],
            "audio_formats": [f.dict() for f in final_audio_formats]
        }

    async def download_video(self, url: str, client_id: str, format_id: str, mode: str):
        loop = asyncio.get_running_loop()
        
        # Create downloads directory if not exists
        os.makedirs("downloads", exist_ok=True)
        
        file_token = str(uuid.uuid4())
        
        def progress_hook(d):
            if d['status'] == 'downloading':
                percent_str = d.get('_percent_str', '0%')
                clean_percent = re.sub(r'\x1b\[[0-9;]*m', '', percent_str).replace('%','')
                try:
                    percent = float(clean_percent)
                except ValueError:
                    percent = 0.0
                
                speed = d.get('_speed_str', '0B/s')
                
                asyncio.run_coroutine_threadsafe(
                    manager.send_personal_message({
                        "status": "downloading",
                        "percent": percent,
                        "speed": speed
                    }, client_id),
                    loop
                )

            elif d['status'] == 'finished':
                 asyncio.run_coroutine_threadsafe(
                    manager.send_personal_message({
                        "status": "finishing",
                        "percent": 100,
                        "message": "Processing..."
                    }, client_id),
                    loop
                )

        # Construct format string
        # If video mode: format_id + bestaudio
        # If audio mode: format_id (if audio only) or bestaudio
        
        if mode == 'video':
            # Use specific video format + best audio (merge)
            format_str = f"{format_id}+bestaudio/best"
            postprocessors = []
            ext_args = {}
        else:
            # Audio mode
            format_str = format_id if format_id else 'bestaudio/best'
            postprocessors = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]
            ext_args = {'postprocessors': postprocessors}

        # Get FFmpeg location if available locally
        ffmpeg_opts = ffmpeg_utils.get_ydl_ffmpeg_opts()
        
        ydl_opts = {
            'progress_hooks': [progress_hook],
            'outtmpl': f'downloads/{file_token}_%(title)s.%(ext)s',
            'format': format_str,
            'noplaylist': True,
            **ext_args,
            **ffmpeg_opts
        }

        async def do_download(opts: dict) -> tuple[str, str]:
            """Execute download with given options, return (token, filepath)."""
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = await loop.run_in_executor(None, lambda: ydl.extract_info(url, download=True))
                
                # Check file location
                if 'requested_downloads' in info:
                    filepath = info['requested_downloads'][0]['filepath']
                else:
                    filepath = ydl.prepare_filename(info)
                    if mode == 'audio':
                        pre, _ = os.path.splitext(filepath)
                        filepath = pre + ".mp3"
                
                return file_token, filepath
        
        try:
            file_token, filepath = await do_download(ydl_opts)
            
            await manager.send_personal_message({
                    "status": "completed",
                    "percent": 100,
                    "file_token": file_token,
                    "filename": os.path.basename(filepath)
            }, client_id)
            
            return file_token, filepath

        except Exception as e:
            error_msg = str(e)
            
            # Check if this is an FFmpeg-related error and we can fallback
            if 'ffmpeg' in error_msg.lower() or 'merging' in error_msg.lower():
                logger.warning(f"FFmpeg error, trying fallback to 'best' format: {error_msg}")
                
                try:
                    # Fallback: use 'best' format (single stream, no merge needed)
                    fallback_opts = {
                        'progress_hooks': [progress_hook],
                        'outtmpl': f'downloads/{file_token}_%(title)s.%(ext)s',
                        'format': 'best',
                        'noplaylist': True,
                        **ffmpeg_opts
                    }
                    
                    await manager.send_personal_message({
                        "status": "downloading",
                        "percent": 0,
                        "message": "Retrying with fallback quality..."
                    }, client_id)
                    
                    file_token, filepath = await do_download(fallback_opts)
                    
                    await manager.send_personal_message({
                            "status": "completed",
                            "percent": 100,
                            "file_token": file_token,
                            "filename": os.path.basename(filepath),
                            "note": "Downloaded with fallback quality (FFmpeg unavailable)"
                    }, client_id)
                    
                    return file_token, filepath
                    
                except Exception as fallback_error:
                    logger.error(f"Fallback download also failed: {fallback_error}")
                    await manager.send_personal_message({
                            "status": "error",
                            "error": f"Download failed: {fallback_error}"
                    }, client_id)
                    raise fallback_error
            
            # Not an FFmpeg error, just report it
            await manager.send_personal_message({
                    "status": "error",
                    "error": error_msg
            }, client_id)
            raise e
