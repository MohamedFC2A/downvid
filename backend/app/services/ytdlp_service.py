import yt_dlp
import asyncio
import re
import os
import uuid
import logging
import tempfile
import glob
import time
from pathlib import Path
from typing import Any, Iterable, List, Optional
from pydantic import BaseModel
from app.api.websocket import manager
from app.core.config import settings
from app.core.admin_log import admin_log
from app.services import ffmpeg_utils
from app.services.rapidapi_service import rapidapi_service

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

    def _is_muxed_av(self, f: dict) -> bool:
        return f.get("vcodec") not in (None, "none") and f.get("acodec") not in (None, "none")

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
        video_only = [f for f in formats if self._is_video_only(f) and (f.get("height") or 0) > 0]
        muxed = [f for f in formats if self._is_muxed_av(f) and (f.get("height") or 0) > 0]
        candidates = video_only or muxed
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

    def _looks_like_cookie_required(self, msg: str) -> bool:
        m = (msg or "").lower()
        needles = [
            "sign in to confirm you’re not a bot",
            "sign in to confirm you're not a bot",
            "confirm you’re not a bot",
            "confirm you're not a bot",
            "use --cookies-from-browser",
            "use --cookies",
            "login required",
            "please sign in",
        ]
        return any(n in m for n in needles)

    def _common_ydl_opts(self) -> dict:
        proxy = (os.getenv("YTDLP_PROXY") or "").strip()
        impersonate = (os.getenv("YTDLP_IMPERSONATE") or "").strip()
        force_ipv4 = (os.getenv("YTDLP_FORCE_IPV4") or "").strip().lower() in ("1", "true", "yes")
        force_ipv6 = (os.getenv("YTDLP_FORCE_IPV6") or "").strip().lower() in ("1", "true", "yes")
        user_agent = (os.getenv("YTDLP_USER_AGENT") or "").strip()
        referer = (os.getenv("YTDLP_REFERER") or "").strip()
        rate_limit = (os.getenv("YTDLP_RATE_LIMIT") or "").strip()
        sleep_interval = (os.getenv("YTDLP_SLEEP_INTERVAL") or "").strip()
        max_sleep_interval = (os.getenv("YTDLP_MAX_SLEEP_INTERVAL") or "").strip()
        extractor_retries = (os.getenv("YTDLP_EXTRACTOR_RETRIES") or "").strip()
        retries = (os.getenv("YTDLP_RETRIES") or "").strip()
        fragment_retries = (os.getenv("YTDLP_FRAGMENT_RETRIES") or "").strip()
        socket_timeout = (os.getenv("YTDLP_SOCKET_TIMEOUT") or "").strip()

        def _to_int(val: str, default: int) -> int:
            try:
                return int(val)
            except Exception:
                return default

        def _to_float(val: str) -> float | None:
            try:
                return float(val)
            except Exception:
                return None

        opts: dict = {
            "nocheckcertificate": True,
            "extractor_retries": _to_int(extractor_retries, 3),
            "retries": _to_int(retries, 5),
            "fragment_retries": _to_int(fragment_retries, 5),
            "socket_timeout": _to_int(socket_timeout, 60),
            "sleep_interval": _to_int(sleep_interval, 1),
            "max_sleep_interval": _to_int(max_sleep_interval, 5),
            "geo_bypass": True,
            "youtube_include_dash_manifest": True,
            "youtube_include_hls_manifest": True,
            "user_agent": user_agent or "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "http_headers": {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
            # YouTube reliability: try multiple clients
            "extractor_args": {"youtube": {"player_client": ["android", "web", "ios"]}},
        }
        if proxy:
            opts["proxy"] = proxy
        if rate_limit:
            rate_val = _to_float(rate_limit)
            if rate_val:
                opts["ratelimit"] = rate_val
        if impersonate:
            # yt-dlp supports `--impersonate` (needs curl-impersonate in some setups)
            opts["impersonate"] = impersonate
        if referer:
            opts["http_headers"]["Referer"] = referer
        if force_ipv4:
            opts["force_ipv4"] = True
        if force_ipv6:
            opts["force_ipv6"] = True
        return opts

    async def get_video_info(self, url: str):
        # Prefer RapidAPI provider when enabled (avoids YouTube anti-bot/cookies issues).
        provider = (settings.DOWNLOAD_PROVIDER or "").strip().lower()
        if provider == "rapidapi":
            try:
                payload = await rapidapi_service.fetch_formats_with_fallback(url)
                available_formats = [
                    VideoFormat(
                        format_id=f.format_id,
                        resolution=f.resolution,
                        extension=f.extension,
                        filesize_str=f.filesize_str,
                        note=f.note or "",
                        height=f.height,
                        abr=f.abr,
                        vcodec=f.vcodec,
                        acodec=f.acodec,
                    ).model_dump()
                    for f in payload["video"]
                ]
                audio_formats = [
                    VideoFormat(
                        format_id=f.format_id,
                        resolution=f.resolution,
                        extension=f.extension,
                        filesize_str=f.filesize_str,
                        note=f.note or "Audio",
                        height=f.height,
                        abr=f.abr,
                        vcodec=f.vcodec,
                        acodec=f.acodec,
                    ).model_dump()
                    for f in payload["audio"]
                ]
                return {
                    "title": payload.get("title"),
                    "thumbnail": payload.get("thumbnail"),
                    "description": f"Source: {payload.get('platform')}",
                    "available_formats": available_formats,
                    "audio_formats": audio_formats,
                    "duration_seconds": payload.get("duration") or None,
                    "extractor": payload.get("platform"),
                    "id": None,
                    "formats_count": len(available_formats) + len(audio_formats),
                }
            except Exception as e:
                admin_log.add("rapidapi_error", {"stage": "get_video_info", "error": str(e)})
                # When rapidapi is selected explicitly, do not fall back to yt-dlp
                # (avoids triggering YouTube anti-bot/cookies failures).
                raise Exception(f"RapidAPI provider failed: {e}")

        loop = asyncio.get_running_loop()
        # Cookies can be required for some YouTube flows (consent/age/region).
        # Prefer env-provided cookies, fall back to local cookies.txt for dev.
        env_cookie_path = (os.getenv("YTDLP_COOKIES_PATH") or "").strip()
        env_cookie_b64 = (os.getenv("YTDLP_COOKIES_B64") or "").strip()
        cookies_path = Path(env_cookie_path) if env_cookie_path else Path("backend/cookies.txt")
        if not cookies_path.exists():
            cookies_path = Path("cookies.txt")

        ydl_opts = {
            "quiet": True,
            "noplaylist": True,
            "ignoreerrors": False,
            "verbose": True,
            "extract_flat": False,  # Extract full metadata
            "youtube_include_dash_manifest": True,  # Include DASH formats for all qualities
            "youtube_include_hls_manifest": True,  # Include HLS formats
            **self._common_ydl_opts(),
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
        
        # Process Video Formats
        # Group formats by resolution and select the best format for each quality level
        formats_sorted = sorted(formats, key=lambda x: (x.get('height') or 0, x.get('tbr') or 0), reverse=True)

        def _codec_rank(vcodec: Optional[str]) -> int:
            if not vcodec:
                return 0
            v = vcodec.lower()
            if "av01" in v:
                return 4
            if "vp9" in v:
                return 3
            if "avc1" in v or "h264" in v:
                return 2
            return 1

        def _video_score(f: dict) -> tuple:
            tbr = float(f.get("tbr") or 0.0)
            fps = float(f.get("fps") or 0.0)
            filesize = float(f.get("filesize") or f.get("filesize_approx") or 0.0)
            codec_rank = _codec_rank(f.get("vcodec"))
            muxed_bonus = 1 if self._is_muxed_av(f) else 0
            return (tbr, codec_rank, fps, filesize, muxed_bonus)

        # Group by resolution (height) and keep the best format for each
        quality_groups: dict[int, dict] = {}

        for f in formats_sorted:
            if not (self._is_video_only(f) or self._is_muxed_av(f)):
                continue

            height = f.get('height')
            if not height or height <= 0:
                continue

            height = int(height)
            existing = quality_groups.get(height)
            if existing is None or _video_score(f) > _video_score(existing):
                quality_groups[height] = f
        
        # Convert grouped formats to VideoFormat objects
        for height in sorted(quality_groups.keys(), reverse=True):
            f = quality_groups[height]
            ext = f.get('ext') or 'unknown'
            res_str = f"{height}p"
            filesize = f.get('filesize') or f.get('filesize_approx')
            note = f.get('format_note', '') or ''
            kind = "Muxed" if self._is_muxed_av(f) else "Video-only"
            if kind.lower() not in note.lower():
                note = (note + f" • {kind}").strip(" •")
            if f.get("fps"):
                fps_val = int(round(float(f.get("fps"))))
                note = (note + f" • {fps_val}fps").strip(" •")
            
            # Add codec info for clarity
            vcodec = f.get("vcodec")
            if vcodec and vcodec != "none":
                codec_short = vcodec.split('.')[0]  # e.g., "avc1.42001E" -> "avc1"
                if codec_short not in note:
                    note = (note + f" • {codec_short}").strip(" •")

            available_formats.append(
                VideoFormat(
                    format_id=str(f.get('format_id')),
                    resolution=res_str,
                    extension=ext,
                    filesize_str=self._format_filesize(filesize),
                    note=note,
                    height=int(height),
                    fps=f.get("fps"),
                    vcodec=f.get("vcodec"),
                    acodec=f.get("acodec"),
                )
            )

        # Process Audio Formats
        for f in formats:
            if self._is_audio_only(f):
                ext = f.get('ext')
                if not ext:
                    continue
                filesize = f.get('filesize') or f.get('filesize_approx')
                audio_formats.append(VideoFormat(
                    format_id=f['format_id'],
                    resolution="Audio",
                    extension=ext,
                    filesize_str=self._format_filesize(filesize),
                    note=f.get('format_note', 'Audio Only'),
                    abr=f.get("abr"),
                    vcodec=f.get("vcodec"),
                    acodec=f.get("acodec"),
                ))

        # Prefer higher bitrate audio options; keep all formats for UI.
        final_audio_formats = sorted(audio_formats, key=lambda x: (x.abr or 0, x.filesize_str), reverse=True)

        admin_log.add(
            "analysis_formats",
            {
                "title": info.get("title"),
                "extractor": info.get("extractor"),
                "id": info.get("id"),
                "formats_count": len(formats),
                "video_qualities": sorted(quality_groups.keys(), reverse=True)[:12],
                "audio_formats_count": len(final_audio_formats),
            },
        )

        # Fallback: if no video formats matched filters, try raw extraction with grouping
        if not available_formats and formats:
            fallback_groups = {}
            for f in formats_sorted:
                if not (self._is_video_only(f) or self._is_muxed_av(f)):
                    continue
                height = f.get("height")
                if not height or height <= 0:
                    continue
                if height not in fallback_groups:
                    fallback_groups[height] = f
                if len(fallback_groups) >= 8:  # Limit fallback to 8 qualities
                    break
            
            for height in sorted(fallback_groups.keys(), reverse=True):
                f = fallback_groups[height]
                fmt_id = f.get("format_id")
                ext = f.get("ext") or "unknown"
                res_str = f"{height}p"
                filesize = f.get('filesize') or f.get('filesize_approx')
                available_formats.append(VideoFormat(
                    format_id=str(fmt_id),
                    resolution=res_str,
                    extension=ext,
                    filesize_str=self._format_filesize(filesize),
                    note=f.get('format_note', '') or '',
                    height=height,
                    fps=f.get("fps"),
                    vcodec=f.get("vcodec"),
                    acodec=f.get("acodec"),
                ))

        # Also return raw info for title etc
        return {
            "title": info.get('title'),
            "thumbnail": info.get('thumbnail'),
            "description": info.get('description'),
            "available_formats": [f.model_dump() for f in available_formats],
            "audio_formats": [f.model_dump() for f in final_audio_formats],
            "duration_seconds": info.get("duration"),
            "extractor": info.get("extractor"),
            "id": info.get("id"),
            "formats_count": len(formats),
        }

    def _vtt_to_text(self, raw: str) -> str:
        lines = []
        for line in (raw or "").splitlines():
            s = line.strip()
            if not s:
                continue
            if s.upper() == "WEBVTT":
                continue
            # timestamps, cues, or styling
            if "-->" in s:
                continue
            if s.isdigit():
                continue
            if s.startswith(("NOTE", "STYLE", "REGION")):
                continue
            # remove simple HTML tags
            s = re.sub(r"<[^>]+>", "", s).strip()
            if not s:
                continue
            lines.append(s)
        # collapse duplicates / keep readable
        text = " ".join(lines)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    async def get_transcript_text(self, url: str, *, lang: str = "ar") -> Optional[str]:
        """
        Best-effort transcript extraction using yt-dlp subtitles/automatic captions.
        Returns plain text or None if unavailable.
        """
        loop = asyncio.get_running_loop()
        lang_norm = (lang or "").strip().lower()
        prefer = []
        if lang_norm.startswith("ar"):
            prefer = ["ar", "ar.*", "en", "en.*"]
        else:
            prefer = ["en", "en.*", "ar", "ar.*"]

        ydl_opts = {
            "quiet": True,
            "noplaylist": True,
            "ignoreerrors": False,
            "skip_download": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitleslangs": prefer,
            "subtitlesformat": "vtt/best",
            **self._common_ydl_opts(),
        }

        tmp_cookie = None
        env_cookie_path = (os.getenv("YTDLP_COOKIES_PATH") or "").strip()
        env_cookie_b64 = (os.getenv("YTDLP_COOKIES_B64") or "").strip()
        cookies_path = Path(env_cookie_path) if env_cookie_path else Path("backend/cookies.txt")
        if not cookies_path.exists():
            cookies_path = Path("cookies.txt")
        if cookies_path.exists():
            ydl_opts["cookiefile"] = str(cookies_path)
        elif env_cookie_b64:
            try:
                import base64

                tmp_cookie = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
                tmp_cookie.write(base64.b64decode(env_cookie_b64))
                tmp_cookie.flush()
                ydl_opts["cookiefile"] = tmp_cookie.name
            except Exception:
                tmp_cookie = None

        def _download_subs() -> Optional[str]:
            with tempfile.TemporaryDirectory() as td:
                outtmpl = os.path.join(td, "%(id)s.%(ext)s")
                local_opts = {**ydl_opts, "outtmpl": outtmpl}
                with yt_dlp.YoutubeDL(local_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    # Trigger subtitle writing
                    ydl.download([url])

                # Find any VTT written
                vtts = glob.glob(os.path.join(td, "*.vtt"))
                if not vtts:
                    return None
                # Pick the largest VTT (usually the main transcript)
                vtts.sort(key=lambda p: os.path.getsize(p), reverse=True)
                try:
                    raw = Path(vtts[0]).read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    raw = Path(vtts[0]).read_text(errors="ignore")
                return self._vtt_to_text(raw)

        try:
            text = await loop.run_in_executor(None, _download_subs)
            if not text:
                return None
            # Avoid gigantic payloads
            return text[:25000]
        except Exception:
            return None
        finally:
            if tmp_cookie:
                try:
                    os.unlink(tmp_cookie.name)
                except Exception:
                    pass

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
        # Prefer RapidAPI provider when enabled.
        if (settings.DOWNLOAD_PROVIDER or "").strip().lower() == "rapidapi":
            return await self._download_via_rapidapi(
                url=url,
                client_id=client_id,
                format_id=format_id,
                mode=mode,
            )
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
                "verbose": True,
                **self._common_ydl_opts(),
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
            picked_id: Optional[str] = None
            if format_id:
                picked_id = str(format_id)
            else:
                picked_id = self._pick_video_format_id(formats_for_choice, target_height=target_height, container=container)

            # If user selected a muxed format (video+audio), don't force "+bestaudio"
            fmt_by_id = {str(f.get("format_id")): f for f in formats_for_choice if f.get("format_id") is not None}
            picked_fmt = fmt_by_id.get(picked_id) if picked_id else None
            picked_is_muxed = bool(picked_fmt and self._is_muxed_av(picked_fmt))

            # Strategy 1: chosen stream + best audio
            if picked_id:
                strategies.append(
                    {
                        "label": "chosen",
                        "format": f"{picked_id}/best" if picked_is_muxed else f"{picked_id}+bestaudio/best",
                        "merge_output_format": container if container in ("mp4", "webm") else None,
                    }
                )

            # Strategy 2: relax container filter, still close to requested height
            relaxed_id = self._pick_video_format_id(formats_for_choice, target_height=target_height, container=None)
            if relaxed_id and relaxed_id != picked_id:
                relaxed_fmt = fmt_by_id.get(relaxed_id)
                relaxed_is_muxed = bool(relaxed_fmt and self._is_muxed_av(relaxed_fmt))
                strategies.append(
                    {
                        "label": "relaxed",
                        "format": f"{relaxed_id}/best" if relaxed_is_muxed else f"{relaxed_id}+bestaudio/best",
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
                "verbose": True,
                **self._common_ydl_opts(),
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
                if self._looks_like_cookie_required(last_error):
                    await manager.send_personal_message(
                        {
                            "status": "error",
                            "error": (
                                "YouTube requires sign-in verification (not-a-bot check). "
                                "Fix: provide cookies via YTDLP_COOKIES_PATH or YTDLP_COOKIES_B64, "
                                "or use a residential proxy (YTDLP_PROXY). Check /api/diagnostics."
                            ),
                        },
                        client_id,
                    )
                    break
                if "HTTP Error 403" in last_error or "403" in last_error and "forbidden" in last_error.lower():
                    await manager.send_personal_message(
                        {
                            "status": "error",
                            "error": (
                                "HTTP 403 (Forbidden) from the provider. "
                                "This usually means the server IP is blocked/rate-limited. "
                                "Fix: provide cookies (YTDLP_COOKIES_PATH/YTDLP_COOKIES_B64) and/or set a proxy (YTDLP_PROXY)."
                            ),
                        },
                        client_id,
                    )
                    break
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

    def _safe_filename(self, s: str) -> str:
        s = (s or "").strip()
        if not s:
            return "download"
        s = re.sub(r"[\\/:*?\"<>|]+", "_", s)
        s = re.sub(r"\s+", " ", s).strip()
        return s[:80]

    async def _download_via_rapidapi(self, *, url: str, client_id: str, format_id: Optional[str], mode: str):
        downloads_dir = Path(settings.DOWNLOADS_DIR)
        downloads_dir.mkdir(parents=True, exist_ok=True)
        file_token = str(uuid.uuid4())

        try:
            payload = await rapidapi_service.fetch_formats_with_fallback(url)
            video = payload.get("video") or []
            audio = payload.get("audio") or []
            candidates = audio if mode == "audio" else video

            chosen = None
            if format_id:
                for f in candidates:
                    if f.format_id == format_id:
                        chosen = f
                        break
            if chosen is None and candidates:
                chosen = candidates[0]
            if chosen is None:
                raise Exception("No downloadable formats found (RapidAPI)")

            ext = chosen.extension or ("mp3" if mode == "audio" else "mp4")
            title = self._safe_filename(payload.get("title") or "video")
            out_path = downloads_dir / f"{file_token}_{title}.{ext}"

            await manager.send_personal_message(
                {"status": "initializing", "percent": 0, "message": "Starting direct download..."},
                client_id,
            )

            start = time.time()
            last_emit = 0.0
            downloaded = 0
            total = None

            import httpx

            headers = {
                # Some CDN links reject unknown agents.
                "User-Agent": os.getenv("YTDLP_USER_AGENT")
                or "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            }

            async with httpx.AsyncClient(follow_redirects=True, timeout=60.0, headers=headers) as client:
                async with client.stream("GET", chosen.url) as resp:
                    resp.raise_for_status()
                    cl = resp.headers.get("content-length")
                    try:
                        total = int(cl) if cl else None
                    except Exception:
                        total = None

                    with open(out_path, "wb") as f:
                        async for chunk in resp.aiter_bytes(chunk_size=1024 * 256):
                            if not chunk:
                                continue
                            f.write(chunk)
                            downloaded += len(chunk)
                            now = time.time()
                            if now - last_emit < 0.4:
                                continue
                            last_emit = now
                            elapsed = max(0.001, now - start)
                            speed_bps = downloaded / elapsed
                            percent = 0
                            eta = ""
                            if total and total > 0:
                                percent = min(99.9, (downloaded / total) * 100.0)
                                rem = total - downloaded
                                eta_s = int(rem / speed_bps) if speed_bps > 0 else 0
                                eta = f"{eta_s}s" if eta_s < 60 else f"{eta_s//60}m {eta_s%60}s"
                            await manager.send_personal_message(
                                {
                                    "status": "downloading",
                                    "percent": float(percent),
                                    "speed": self._format_speed(speed_bps),
                                    "eta": eta,
                                    "downloaded_bytes": downloaded,
                                    "total_bytes": total,
                                },
                                client_id,
                            )

            await manager.send_personal_message(
                {
                    "status": "completed",
                    "percent": 100,
                    "file_token": file_token,
                    "filename": out_path.name,
                    "note": "rapidapi",
                },
                client_id,
            )
            admin_log.add("download_completed", {"client_id": client_id, "label": "rapidapi", "filename": out_path.name})
            return file_token, str(out_path)
        except Exception as e:
            msg = str(e)
            admin_log.add("download_error", {"client_id": client_id, "label": "rapidapi", "error": msg})
            await manager.send_personal_message(
                {
                    "status": "error",
                    "error": (
                        "RapidAPI download failed. "
                        "Fix: verify RAPIDAPI_KEY + quota, and retry. "
                        f"Details: {msg}"
                    )[:900],
                },
                client_id,
            )
            raise
