from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import httpx

from app.core.config import settings


@dataclass(frozen=True)
class RapidFormat:
    format_id: str
    resolution: str
    extension: str
    filesize_str: str
    note: str
    url: str
    height: Optional[int] = None
    abr: Optional[float] = None
    vcodec: Optional[str] = None
    acodec: Optional[str] = None


def _format_bytes(n: Optional[float]) -> str:
    if n is None:
        return "Unknown"
    try:
        b = float(n)
    except Exception:
        return "Unknown"
    if b <= 0:
        return "Unknown"
    units = ["B", "KB", "MB", "GB", "TB"]
    idx = 0
    while b >= 1024 and idx < len(units) - 1:
        b /= 1024
        idx += 1
    return f"{b:.1f}{units[idx]}"


def _parse_height(resolution: str) -> Optional[int]:
    if not resolution:
        return None
    s = str(resolution).lower()
    if "8k" in s:
        return 4320
    if "4k" in s:
        return 2160
    import re

    m = re.search(r"(\d{3,4})p", s)
    if m:
        try:
            return int(m.group(1))
        except Exception:
            return None
    return None


def _detect_audio(fmt: dict[str, Any]) -> bool:
    t = str(fmt.get("type") or fmt.get("mime") or "").lower()
    ext = str(fmt.get("extension") or fmt.get("ext") or "").lower().lstrip(".")
    if "audio" in t:
        return True
    if ext in {"mp3", "m4a", "aac", "wav", "flac", "opus", "ogg"}:
        return True
    vcodec = str(fmt.get("vcodec") or fmt.get("videoCodec") or "").lower()
    acodec = str(fmt.get("acodec") or fmt.get("audioCodec") or "").lower()
    if (vcodec == "none" or vcodec == "") and acodec and acodec != "none":
        return True
    return False


def _collect_formats(data: Any) -> list[dict[str, Any]]:
    candidates = [
        getattr(data, "get", lambda _k, _d=None: None)("medias"),
        getattr(data, "get", lambda _k, _d=None: None)("formats"),
        getattr(data, "get", lambda _k, _d=None: None)("links"),
        getattr(data, "get", lambda _k, _d=None: None)("videos"),
        getattr(data, "get", lambda _k, _d=None: None)("downloads"),
        getattr(getattr(data, "get", lambda _k, _d=None: None)("data") or {}, "get", lambda _k, _d=None: None)("medias"),
        getattr(getattr(data, "get", lambda _k, _d=None: None)("data") or {}, "get", lambda _k, _d=None: None)("formats"),
    ]
    for c in candidates:
        if isinstance(c, list) and c:
            return [x for x in c if isinstance(x, dict)]
    return []


class RapidApiService:
    _base = "https://social-download-all-in-one.p.rapidapi.com"

    def _headers(self) -> dict[str, str]:
        key = (settings.RAPIDAPI_KEY or "").strip()
        host = (settings.RAPIDAPI_HOST or "").strip()
        if not key:
            raise RuntimeError("RAPIDAPI_KEY is not configured")
        if not host:
            raise RuntimeError("RAPIDAPI_HOST is not configured")
        return {
            "x-rapidapi-key": key,
            "x-rapidapi-host": host,
            "Content-Type": "application/json",
        }

    async def autolink(self, url: str) -> dict[str, Any]:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{self._base}/v1/social/autolink",
                headers=self._headers(),
                json={"url": url},
                timeout=45.0,
            )
            res.raise_for_status()
            return res.json()

    async def fetch_formats(self, url: str) -> dict[str, Any]:
        data = await self.autolink(url)
        formats = _collect_formats(data)
        has_audio = any(_detect_audio(f) for f in formats)

        video: list[RapidFormat] = []
        audio: list[RapidFormat] = []

        for idx, f in enumerate(formats):
            link = f.get("url") or f.get("link") or f.get("downloadUrl") or f.get("download_url")
            if not link:
                continue
            ext = str(f.get("extension") or f.get("ext") or f.get("container") or "mp4").lstrip(".") or "mp4"
            is_audio = _detect_audio(f)
            quality_raw = f.get("quality") or f.get("resolution") or f.get("qualityLabel") or f.get("label") or f.get("format") or f.get("name")
            height = f.get("height")
            height_val = int(height) if isinstance(height, (int, float)) and height else _parse_height(str(quality_raw or "")) or None
            resolution = "Audio" if is_audio else (f"{height_val}p" if height_val else (str(quality_raw) if quality_raw else "Standard"))
            size = f.get("formattedSize") or f.get("size") or f.get("filesize") or f.get("fileSize")
            filesize_str = _format_bytes(size if isinstance(size, (int, float)) else None) if not isinstance(size, str) else size
            note = str(f.get("note") or f.get("format_note") or "")
            vcodec = f.get("vcodec") or f.get("videoCodec") or (None if is_audio else "")
            acodec = f.get("acodec") or f.get("audioCodec") or (ext if is_audio else ("none" if has_audio else None))
            abr = f.get("abr") or f.get("bitrate")
            abr_val = float(abr) if isinstance(abr, (int, float)) else None

            fmt_id = str(f.get("format_id") or f.get("id") or f.get("itag") or f"{ext}-{idx}")
            entry = RapidFormat(
                format_id=fmt_id,
                resolution=resolution,
                extension=ext,
                filesize_str=filesize_str or "Unknown",
                note=note,
                url=str(link),
                height=height_val,
                abr=abr_val,
                vcodec=str(vcodec) if vcodec is not None else None,
                acodec=str(acodec) if acodec is not None else None,
            )
            if is_audio:
                audio.append(entry)
            else:
                video.append(entry)

        video.sort(key=lambda x: (x.height or 0), reverse=True)
        audio.sort(key=lambda x: (x.abr or 0), reverse=True)

        title = str(data.get("title") or data.get("name") or "Video")
        thumbnail = str(data.get("thumbnail") or data.get("thumb") or data.get("image") or "")
        platform = str(data.get("source") or data.get("platform") or data.get("provider") or "Unknown")

        return {
            "title": title,
            "thumbnail": thumbnail,
            "platform": platform,
            "video": video,
            "audio": audio,
        }


rapidapi_service = RapidApiService()

