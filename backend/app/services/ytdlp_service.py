import yt_dlp
import asyncio
import re
import os
import uuid
import logging
import tempfile
from pathlib import Path
from typing import Any, Iterable, List, Optional
from pydantic import BaseModel
from app.api.websocket import manager
from app.core.config import settings
from app.core.admin_log import admin_log
from app.services import ffmpeg_utils

logger = logging.getLogger(__name__)

class VideoFormat(BaseModel):
    format_id: str
    resolution: str  # "1080p", "720p"
    extension: str   # "mp4", "webm"
    filesize_str: str # "15MB"
    note: str        # "High Quality"
    height: Optional[int] = None
    fps: Optional[float] = None
    vcodec: Optional[str] = None
    acodec: Optional[str] = None
    abr: Optional[float] = None

class YtDlpService:
    def _format_filesize(self, bytes_val):
        if not bytes_val: return "Unknown"
        for unit in ['B', 'KB', 'MB', 'GB']:
            if bytes_val < 1024:
                return f"{bytes_val:.1f}{unit}"
            bytes_val /= 1024
        return f"{bytes_val:.1f}TB"

    def _format_speed(self, bytes_per_sec: Optional[float]) -> str:
        if not bytes_per_sec:
            return ""
        return f"{self._format_filesize(bytes_per_sec)}/s"

    def _format_eta(self, seconds: Optional[float]) -> str:
        if seconds is None:
            return ""
        try:
            s = int(seconds)
        except Exception:
            return ""
        if s < 0:
            return ""
        if s < 60:
            return f"{s}s"
        if s < 3600:
            return f"{s//60}m {s%60}s"
        return f"{s//3600}h {(s%3600)//60}m"

    def _is_video_only(self, f: dict) -> bool:
        return f.get("vcodec") not in (None, "none") and f.get("acodec") in (None, "none")

    def _is_audio_only(self, f: dict) -> bool:
        return f.get("vcodec") in (None, "none") and f.get("acodec") not in (None, "none")

    def _iter_formats(self, info: dict) -> Iterable[dict]:
        for f in info.get("formats") or []:
            if isinstance(f, dict):
                yield f

    def _pick_video_format_id(
        self,
        formats: list[dict],
        *,
        target_height: int,
        container: Optional[str],
    ) -> Optional[str]:
        candidates = [f for f in formats if self._is_video_only(f) and (f.get("height") or 0) > 0]
        if container:
            candidates = [f for f in candidates if f.get("ext") == container]
        if not candidates:
            return None

        def key(f: dict) -> tuple[int, int, int, float, float]:
            height = int(f.get("height") or 0)
            within = 1 if height <= target_height else 0
            diff = abs(target_height - height)
            tbr = float(f.get("tbr") or 0.0)
            filesize = float(f.get("filesize") or f.get("filesize_approx") or 0.0)
            return (within, -diff, height, tbr, filesize)

        best = sorted(candidates, key=key, reverse=True)[0]
        return best.get("format_id")

    def _pick_audio_format_id(
        self,
        formats: list[dict],
        *,
        container: Optional[str],
    ) -> Optional[str]:
        candidates = [f for f in formats if self._is_audio_only(f)]
        if container and container not in ("mp3",):
            candidates = [f for f in candidates if f.get("ext") == container]
        if not candidates:
            return None

        def key(f: dict) -> tuple[float, float]:
            abr = float(f.get("abr") or 0.0)
            filesize = float(f.get("filesize") or f.get("filesize_approx") or 0.0)
            return (abr, filesize)

        best = sorted(candidates, key=key, reverse=True)[0]
        return best.get("format_id")

    def _looks_like_format_error(self, msg: str) -> bool:
        m = msg.lower()
        needles = [
            "requested format is not available",
            "requested format not available",
            "format is not available",
            "no video formats found",
            "no formats found",
            "requested format",
        ]
        return any(n in m for n in needles)

    def _looks_like_transient_error(self, msg: str) -> bool:
        m = msg.lower()
        needles = [
            "timed out",
            "temporar",
            "connection reset",
            "connection aborted",
            "tls",
            "http error 5",
            "service unavailable",
        ]
        return any(n in m for n in needles)

    async def get_video_info(self, url: str):
        loop = asyncio.get_running_loop()
        # Cookies can be required for some YouTube flows (consent/age/region).
        # Prefer env-provided cookies, fall back to local cookies.txt for dev.
        env_cookie_path = (os.getenv("YTDLP_COOKIES_PATH") or "").strip()
        env_cookie_b64 = (os.getenv("YTDLP_COOKIES_B64") or "").strip()
        cookies_path = Path(env_cookie_path) if env_cookie_path else Path("backend/cookies.txt")
        if not cookies_path.exists():
            cookies_path = Path("cookies.txt")

        ydl_opts = {
            'quiet': True, 
            'noplaylist': True,
            'nocheckcertificate': True,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'extractor_retries': 3,
            # YouTube reliability: try multiple clients
            'extractor_args': {'youtube': {'player_client': ['android', 'web', 'ios']}},
            'verbose': True,
            'http_headers': {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
            },
            'socket_timeout': 60,
            'retries': 5,
            'fragment_retries': 5,
            'sleep_interval': 1,
            'max_sleep_interval': 5,
            'ignoreerrors': False,
        }
        
        tmp_cookie = None
        if cookies_path.exists():
            ydl_opts['cookiefile'] = str(cookies_path)
        elif env_cookie_b64:
            try:
                import base64

                tmp_cookie = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
                tmp_cookie.write(base64.b64decode(env_cookie_b64))
                tmp_cookie.flush()
                ydl_opts["cookiefile"] = tmp_cookie.name
            except Exception:
                tmp_cookie = None
              
        def fetch_info():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(url, download=False)

        try:
            info = await loop.run_in_executor(None, fetch_info)
        finally:
            if tmp_cookie:
                try:
                    os.unlink(tmp_cookie.name)
                except Exception:
                    pass
        
        formats = list(self._iter_formats(info))
        available_formats = []
        audio_formats = []
        
        # Process Video Formats (video-only streams preferred for best quality)
        # Show unique combos per (height, ext) to make selection clearer.
        seen = set()
        formats_sorted = sorted(formats, key=lambda x: (x.get('height') or 0, x.get('tbr') or 0), reverse=True)
        
        for f in formats_sorted:
            if self._is_video_only(f):
                height = f.get('height')
                if not height: continue
                
                res_str = f"{height}p"
                ext = f.get('ext')
                if not ext: 
                    continue
                sig = (int(height), ext)
                if sig in seen:
                    continue
                
                valid_ext = ext in ['mp4', 'webm']
                if not valid_ext: continue
                
                filesize = f.get('filesize') or f.get('filesize_approx')
                
                available_formats.append(VideoFormat(
                    format_id=f['format_id'],
                    resolution=res_str,
                    extension=ext,
                    filesize_str=self._format_filesize(filesize),
                    note=f.get('format_note', ''),
                    height=int(height),
                    fps=f.get("fps"),
                    vcodec=f.get("vcodec"),
                    acodec=f.get("acodec"),
                ))
                seen.add(sig)

        # Process Audio Formats
        for f in formats:
             if self._is_audio_only(f):
                filesize = f.get('filesize') or f.get('filesize_approx')
                audio_formats.append(VideoFormat(
                    format_id=f['format_id'],
                    resolution="Audio",
                    extension=f['ext'],
                    filesize_str=self._format_filesize(filesize),
                    note=f.get('format_note', 'Audio Only'),
                    abr=f.get("abr"),
                    vcodec=f.get("vcodec"),
                    acodec=f.get("acodec"),
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
            "available_formats": [f.model_dump() for f in available_formats],
            "audio_formats": [f.model_dump() for f in final_audio_formats],
            "extractor": info.get("extractor"),
            "id": info.get("id"),
            "formats_count": len(formats),
        }

    async def download_video(
        self,
        *,
        url: str,
        client_id: str,
        format_id: Optional[str],
        mode: str,
        container: Optional[str] = None,
        height: Optional[Any] = None,
    ):
        loop = asyncio.get_running_loop()
        
        downloads_dir = Path(settings.DOWNLOADS_DIR)
        downloads_dir.mkdir(parents=True, exist_ok=True)
        
        file_token = str(uuid.uuid4())
        
        # Best-effort: extract formats for smarter selection/fallbacks
        info_for_choice: Optional[dict] = None
        formats_for_choice: list[dict] = []
        try:
            # Try to find a cookies file
            env_cookie_path = (os.getenv("YTDLP_COOKIES_PATH") or "").strip()
            env_cookie_b64 = (os.getenv("YTDLP_COOKIES_B64") or "").strip()
            cookies_path = Path(env_cookie_path) if env_cookie_path else Path("backend/cookies.txt")
            if not cookies_path.exists():
                cookies_path = Path("cookies.txt")

            ydl_info_opts = {
                "quiet": True, 
                "noplaylist": True,
                "nocheckcertificate": True,
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                "extractor_retries": 3,
                "extractor_args": {"youtube": {"player_client": ["android", "web", "ios"]}},
                "verbose": True,
                "http_headers": {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                "socket_timeout": 60,
                "retries": 5,
                "fragment_retries": 5,
            }
            
            tmp_cookie = None
            if cookies_path.exists():
                ydl_info_opts['cookiefile'] = str(cookies_path)
            elif env_cookie_b64:
                try:
                    import base64

                    tmp_cookie = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
                    tmp_cookie.write(base64.b64decode(env_cookie_b64))
                    tmp_cookie.flush()
                    ydl_info_opts["cookiefile"] = tmp_cookie.name
                except Exception:
                    tmp_cookie = None

            def _extract():
                with yt_dlp.YoutubeDL(ydl_info_opts) as ydl:
                    return ydl.extract_info(url, download=False)

            try:
                info_for_choice = await loop.run_in_executor(None, _extract)
            finally:
                if tmp_cookie:
                    try:
                        os.unlink(tmp_cookie.name)
                    except Exception:
                        pass
            formats_for_choice = list(self._iter_formats(info_for_choice))
            admin_log.add(
                "formats",
                {
                    "title": info_for_choice.get("title"),
                    "extractor": info_for_choice.get("extractor"),
                    "id": info_for_choice.get("id"),
                    "formats_count": len(formats_for_choice),
                    "heights": sorted({int(f.get("height") or 0) for f in formats_for_choice if (f.get("height") or 0) > 0}, reverse=True)[:12],
                },
            )
        except Exception as e:
            admin_log.add("formats_error", {"error": str(e)})

        def progress_hook(d):
            if d['status'] == 'downloading':
                percent_str = d.get('_percent_str', '0%')
                clean_percent = re.sub(r'\x1b\[[0-9;]*m', '', percent_str).replace('%','')
                try:
                    percent = float(clean_percent)
                except ValueError:
                    percent = 0.0
                
                speed = d.get('speed')
                eta = d.get('eta')
                downloaded = d.get("downloaded_bytes")
                total = d.get("total_bytes") or d.get("total_bytes_estimate")
                speed_str = d.get('_speed_str') or self._format_speed(speed)
                eta_str = d.get('_eta_str') or self._format_eta(eta)
                
                asyncio.run_coroutine_threadsafe(
                    manager.send_personal_message({
                        "status": "downloading",
                        "percent": percent,
                        "speed": speed_str,
                        "eta": eta_str,
                        "downloaded_bytes": downloaded,
                        "total_bytes": total,
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

        # Normalize inputs
        mode = (mode or "video").lower()
        if mode not in ("video", "audio"):
            mode = "video"
        container = (container or "").lower() or None
        if container and container not in ("mp4", "webm", "m4a", "mp3"):
            container = None
        try:
            target_height = int(height) if height is not None else 1080
        except Exception:
            target_height = 1080
        target_height = max(144, min(4320, target_height))

        # Build an ordered list of strategies (format string + options) to try.
        strategies: list[dict] = []

        if mode == "video":
            picked_id = None
            if format_id:
                picked_id = str(format_id)
            else:
                picked_id = self._pick_video_format_id(formats_for_choice, target_height=target_height, container=container)

            # Strategy 1: chosen stream + best audio
            if picked_id:
                strategies.append(
                    {
                        "label": "chosen",
                        "format": f"{picked_id}+bestaudio/best",
                        "merge_output_format": container if container in ("mp4", "webm") else None,
                    }
                )

            # Strategy 2: relax container filter, still close to requested height
            relaxed_id = self._pick_video_format_id(formats_for_choice, target_height=target_height, container=None)
            if relaxed_id and relaxed_id != picked_id:
                strategies.append(
                    {
                        "label": "relaxed",
                        "format": f"{relaxed_id}+bestaudio/best",
                        "merge_output_format": None,
                    }
                )

            # Strategy 3: generic best within height (yt-dlp selector)
            # This avoids "format_id not available" issues entirely.
            strategies.append(
                {
                    "label": "selector",
                    "format": f"bestvideo[height<={target_height}]+bestaudio/best[height<={target_height}]/best[height<={target_height}]/best",
                    "merge_output_format": container if container in ("mp4", "webm") else None,
                }
            )
        else:
            # audio
            picked_audio = str(format_id) if format_id else self._pick_audio_format_id(formats_for_choice, container=container)
            if picked_audio:
                strategies.append({"label": "chosen", "format": picked_audio})
            # generic selector
            strategies.append({"label": "selector", "format": "bestaudio/best"})

        admin_log.add(
            "download_request",
            {
                "client_id": client_id,
                "mode": mode,
                "container": container,
                "height": target_height if mode == "video" else None,
                "format_id": format_id,
            },
        )

        # Get FFmpeg location if available locally
        ffmpeg_opts = ffmpeg_utils.get_ydl_ffmpeg_opts()
        outtmpl = str(downloads_dir / f"{file_token}_%(title)s.%(ext)s")
        
        async def do_download(format_str: str, extra_opts: dict) -> tuple[str, str]:
            """Execute download with given options, return (token, filepath)."""
            # Try to find a cookies file
            env_cookie_path = (os.getenv("YTDLP_COOKIES_PATH") or "").strip()
            env_cookie_b64 = (os.getenv("YTDLP_COOKIES_B64") or "").strip()
            cookies_path = Path(env_cookie_path) if env_cookie_path else Path("backend/cookies.txt")
            if not cookies_path.exists():
                cookies_path = Path("cookies.txt")

            opts = {
                "progress_hooks": [progress_hook],
                "outtmpl": outtmpl,
                "format": format_str,
                "noplaylist": True,
                "nocheckcertificate": True,
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                "extractor_retries": 3,
                "extractor_args": {"youtube": {"player_client": ["android", "web", "ios"]}},
                "verbose": True,
                "http_headers": {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                "socket_timeout": 60,
                "retries": 5,
                "fragment_retries": 5,
                **extra_opts,
                **ffmpeg_opts,
            }
            
            tmp_cookie = None
            if cookies_path.exists():
                opts['cookiefile'] = str(cookies_path)
            elif env_cookie_b64:
                try:
                    import base64

                    tmp_cookie = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
                    tmp_cookie.write(base64.b64decode(env_cookie_b64))
                    tmp_cookie.flush()
                    opts["cookiefile"] = tmp_cookie.name
                except Exception:
                    tmp_cookie = None

            with yt_dlp.YoutubeDL(opts) as ydl:
                try:
                    info = await loop.run_in_executor(None, lambda: ydl.extract_info(url, download=True))
                finally:
                    if tmp_cookie:
                        try:
                            os.unlink(tmp_cookie.name)
                        except Exception:
                            pass

                if "requested_downloads" in info and info["requested_downloads"]:
                    filepath = info["requested_downloads"][0]["filepath"]
                else:
                    filepath = ydl.prepare_filename(info)
                    if mode == "audio" and container == "mp3":
                        pre, _ = os.path.splitext(filepath)
                        filepath = pre + ".mp3"

                return file_token, filepath

        # Common extra options (postprocessors etc.)
        def extra_opts_for(mode_: str, container_: Optional[str], merge_output_format: Optional[str]) -> dict:
            extra: dict = {}
            if mode_ == "audio" and container_ == "mp3":
                extra["postprocessors"] = [
                    {
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "mp3",
                        "preferredquality": "192",
                    }
                ]
            if merge_output_format:
                extra["merge_output_format"] = merge_output_format
            return extra

        last_error: Optional[str] = None
        for attempt_idx, strat in enumerate(strategies, start=1):
            fmt = strat["format"]
            label = strat.get("label", f"attempt_{attempt_idx}")
            merge_output = strat.get("merge_output_format")
            extra_opts = extra_opts_for(mode, container, merge_output)

            admin_log.add("download_attempt", {"client_id": client_id, "attempt": attempt_idx, "label": label, "format": fmt})
            await manager.send_personal_message(
                {
                    "status": "initializing",
                    "percent": 0,
                    "message": f"Starting ({label})...",
                },
                client_id,
            )

            try:
                file_token, filepath = await do_download(fmt, extra_opts)
                await manager.send_personal_message(
                    {
                        "status": "completed",
                        "percent": 100,
                        "file_token": file_token,
                        "filename": os.path.basename(filepath),
                        "note": label if label != "chosen" else None,
                    },
                    client_id,
                )
                admin_log.add("download_completed", {"client_id": client_id, "label": label, "filename": os.path.basename(filepath)})
                return file_token, filepath
            except Exception as e:
                last_error = str(e)
                admin_log.add("download_error", {"client_id": client_id, "label": label, "error": last_error})
                if self._looks_like_format_error(last_error):
                    await manager.send_personal_message(
                        {
                            "status": "downloading",
                            "percent": 0,
                            "message": "Requested format unavailable. Trying closest available...",
                        },
                        client_id,
                    )
                    continue
                if self._looks_like_transient_error(last_error) and attempt_idx < len(strategies):
                    await manager.send_personal_message(
                        {
                            "status": "downloading",
                            "percent": 0,
                            "message": "Temporary error. Retrying...",
                        },
                        client_id,
                    )
                    await asyncio.sleep(min(3 * attempt_idx, 8))
                    continue
                break

        await manager.send_personal_message(
            {
                "status": "error",
                "error": last_error or "Download failed",
            },
            client_id,
        )
        raise Exception(last_error or "Download failed")
