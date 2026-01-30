from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any, List, Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator
from starlette.background import BackgroundTask

from app.core.config import settings
from app.core.auth import require_user_id
from app.core.admin_log import admin_log
from app.services.supabase_service import supabase_service
from app.services.deepseek_service import deepseek_service
from app.services.yt_dlp_cli import (
    YtDlpError,
    cookies_env_diagnostics,
    download_to_file,
    dump_json,
    has_ffmpeg,
    is_serverless_runtime,
    normalize_formats,
    validate_format_selector,
)

router = APIRouter()


@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "downvid-api"}


@router.get("/me")
async def me(authorization: str | None = Header(default=None)):
    if not settings.SUPABASE_ENABLED:
        return {
            "plan": "ultimate",
            "downloads_used": 0,
            "downloads_remaining": None,
            "ultimate_until": None,
            "ai_enabled": True,
        }

    user_id = await require_user_id(authorization)
    profile = await supabase_service.get_or_create_profile(user_id)
    return {
        "plan": profile.effective_plan,
        "downloads_used": profile.downloads_used,
        "downloads_remaining": profile.downloads_remaining,
        "ultimate_until": profile.ultimate_until,
        "ai_enabled": profile.ai_enabled,
    }


class RedeemRequest(BaseModel):
    code: str

    @field_validator("code")
    @classmethod
    def _validate_code(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 4:
            raise ValueError("Invalid code")
        return v


@router.post("/promo/redeem")
async def redeem_promo(request: Request, authorization: str | None = Header(default=None)):
    if not settings.SUPABASE_ENABLED:
        return {"success": True, "message": "Ultimate activated", "plan": "ultimate", "ultimate_until": None}

    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" in content_type:
        try:
            payload = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON body")
    else:
        form = await request.form()
        payload = {"code": str(form.get("code") or "")}

    try:
        req = RedeemRequest.model_validate(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    user_id = await require_user_id(authorization)
    try:
        out = await supabase_service.redeem_promo_code(user_id=user_id, code=req.code)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Redeem failed: {e}")
    return out


class AnalyzeRequest(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def _validate_url(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("URL is required")
        if len(v) > 2048:
            raise ValueError("URL is too long")
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return v


class QualityFormat(BaseModel):
    format_id: str
    container: str = Field(description="mp4/webm/m4a/opus/etc")
    video_codec: Optional[str]
    audio_codec: Optional[str]
    width: Optional[int]
    height: Optional[int]
    fps: Optional[float]
    vbr: Optional[float]
    abr: Optional[float]
    tbr: Optional[float]
    filesize: Optional[int]
    filesize_approx: Optional[int]
    kind: Literal["muxed", "video_only", "audio_only", "unknown"]


class AnalyzeResponse(BaseModel):
    title: str
    thumbnail: Optional[str] = None
    description: Optional[str] = None
    duration: Optional[float] = None
    formats: List[QualityFormat]
    formats_count: int = 0
    playable_formats_count: int = 0
    analysis: Optional[dict[str, Any]] = None


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_video(req: AnalyzeRequest, ai: bool = False, lang: str = "ar", authorization: str | None = Header(default=None)):
    try:
        info = dump_json(req.url)
        formats = normalize_formats(info)
        playable = [f for f in formats if (f.is_muxed or f.is_video_only or f.is_audio_only)]
        extractor = str(info.get("extractor") or "").lower()
        if extractor.startswith("youtube") and len(playable) == 0:
            raise YtDlpError(
                "YouTube returned no downloadable formats (only storyboards/metadata). "
                "This usually means the server IP is blocked or cookies are insufficient. "
                "Try refreshing cookies (YTDLP_COOKIES_PATH / YTDLP_COOKIES_B64). "
                "If you're running locally on Windows/macOS, you can also use YTDLP_COOKIES_FROM_BROWSER=chrome."
            )
        out_formats: List[QualityFormat] = []
        for f in formats:
            if f.is_muxed:
                kind: Literal["muxed", "video_only", "audio_only", "unknown"] = "muxed"
            elif f.is_video_only:
                kind = "video_only"
            elif f.is_audio_only:
                kind = "audio_only"
            else:
                kind = "unknown"
            out_formats.append(
                QualityFormat(
                    format_id=f.format_id,
                    container=f.container,
                    video_codec=f.video_codec,
                    audio_codec=f.audio_codec,
                    width=f.width,
                    height=f.height,
                    fps=f.fps,
                    vbr=f.vbr,
                    abr=f.abr,
                    tbr=f.tbr,
                    filesize=f.filesize,
                    filesize_approx=f.filesize_approx,
                    kind=kind,
                )
            )

        title = str(info.get("title") or "Video")
        thumbnail = info.get("thumbnail")
        description_raw = info.get("description") or info.get("full_description") or ""
        description = str(description_raw).strip() or None
        duration = info.get("duration")
        duration_val: Optional[float] = None
        try:
            duration_val = float(duration) if duration is not None else None
        except Exception:
            duration_val = None

        analysis: Optional[dict[str, Any]] = None
        if ai:
            if settings.SUPABASE_ENABLED:
                user_id = await require_user_id(authorization)
                profile = await supabase_service.get_or_create_profile(user_id)
                if profile.ai_enabled:
                    analysis = await deepseek_service.analyze_metadata(title, description or "", lang=lang)
            else:
                analysis = await deepseek_service.analyze_metadata(title, description or "", lang=lang)

        admin_log.add(
            "analyze",
            {
                "title": title,
                "extractor": info.get("extractor"),
                "id": info.get("id"),
                "formats_count": len(out_formats),
                "playable_formats_count": len(playable),
                "ai": bool(ai),
            },
        )

        return AnalyzeResponse(
            title=title,
            thumbnail=str(thumbnail) if thumbnail else None,
            description=description,
            duration=duration_val,
            formats=out_formats,
            formats_count=len(out_formats),
            playable_formats_count=len(playable),
            analysis=analysis,
        )
    except YtDlpError as e:
        admin_log.add("analyze_error", {"url": req.url, "error": str(e)})
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        admin_log.add("analyze_error", {"url": req.url, "error": str(e)})
        raise HTTPException(status_code=500, detail="Analyze failed")


@router.post("/summarize")
async def summarize(req: AnalyzeRequest, lang: str = "ar", authorization: str | None = Header(default=None)):
    if settings.SUPABASE_ENABLED:
        user_id = await require_user_id(authorization)
        profile = await supabase_service.get_or_create_profile(user_id)
        if not profile.ai_enabled:
            raise HTTPException(status_code=403, detail="AI features require Ultimate")

    try:
        info = dump_json(req.url)
        title = str(info.get("title") or "Video")
        description_raw = info.get("description") or info.get("full_description") or ""
        description = str(description_raw).strip()
        # Transcript extraction is platform-dependent; start with metadata fallback.
        return await deepseek_service.summarize_video(title=title, description=description, transcript_text=None, lang=lang)
    except YtDlpError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Summarize failed")


class DownloadRequest(BaseModel):
    url: str
    selected_format_id: str = Field(alias="selected_format_id")
    mode: Literal["auto", "video", "audio", "av"] = "auto"
    access_token: Optional[str] = None

    @field_validator("url")
    @classmethod
    def _validate_url(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("URL is required")
        if len(v) > 2048:
            raise ValueError("URL is too long")
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return v

    @field_validator("selected_format_id")
    @classmethod
    def _validate_format_id(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("selected_format_id is required")
        return v


def _pick_compatible_audio_format(video_container: str, audio_only: list[Any]):
    """
    Prefer audio that commonly muxes well with the video container:
    - mp4 video -> m4a/mp4 audio
    - webm video -> opus/webm audio
    Fall back to highest abr/filesize.
    """
    vc = (video_container or "").lower()
    if vc == "mp4":
        preferred = {"m4a", "mp4"}
    elif vc == "webm":
        preferred = {"opus", "webm"}
    else:
        preferred = set()

    def score(f: Any):
        c = (getattr(f, "container", "") or "").lower()
        pref = 1 if (preferred and c in preferred) else 0
        abr = getattr(f, "abr", None) or 0.0
        size = getattr(f, "filesize", None) or getattr(f, "filesize_approx", None) or 0
        return (pref, abr, size)

    return sorted(audio_only, key=score, reverse=True)[0] if audio_only else None


@router.post("/download")
async def download(request: Request, background: BackgroundTasks, authorization: str | None = Header(default=None)):
    if is_serverless_runtime():
        raise HTTPException(status_code=503, detail="Downloads are disabled in serverless runtime. Use a VPS/container deployment.")

    content_type = (request.headers.get("content-type") or "").lower()
    payload: Any
    if "application/json" in content_type:
        try:
            payload = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON body")
    else:
        form = await request.form()
        payload = {
            "url": str(form.get("url") or ""),
            "selected_format_id": str(form.get("selected_format_id") or form.get("format_id") or ""),
            "mode": str(form.get("mode") or "auto"),
            "access_token": str(form.get("access_token") or ""),
        }

    try:
        req = DownloadRequest.model_validate(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    authz = authorization
    if not authz and req.access_token:
        authz = f"Bearer {req.access_token}"

    if settings.SUPABASE_ENABLED:
        user_id = await require_user_id(authz)
        try:
            quota = await supabase_service.consume_download(user_id)
        except Exception as e:
            admin_log.add("subscription_error", {"error": str(e)})
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Subscription check failed: {e}. "
                    "Make sure you applied `backend/supabase/schema.sql` in your Supabase project."
                ),
            )
        if not bool(quota.get("allowed")):
            raise HTTPException(status_code=403, detail="FREE limit reached")

    try:
        info = dump_json(req.url)
        formats = normalize_formats(info)
        available_ids = {f.format_id for f in formats}
        parts = validate_format_selector(req.selected_format_id, available_ids)

        # Enforce "auto" merge behavior without using best/bestaudio.
        selector = req.selected_format_id
        if len(parts) == 1:
            fid = parts[0]
            fmt = next((f for f in formats if f.format_id == fid), None)
            if not fmt:
                raise YtDlpError(f"Requested format_id is not available: {fid}")

            if req.mode in ("audio",) and not fmt.is_audio_only:
                raise YtDlpError("Selected format is not audio-only.")
            if req.mode in ("video",) and not (fmt.is_video_only or fmt.is_muxed):
                raise YtDlpError("Selected format is not a video format.")

            if req.mode in ("av", "auto") and fmt.is_video_only:
                if not has_ffmpeg():
                    raise YtDlpError("Selected format is video-only and requires FFmpeg to merge with audio.")
                # Pick best audio-only by abr/filesize (using real format_ids).
                audio_only = [f for f in formats if f.is_audio_only]
                if not audio_only:
                    raise YtDlpError("No audio-only formats available to merge.")
                best_audio = _pick_compatible_audio_format(fmt.container, audio_only)
                selector = f"{fid}+{best_audio.format_id}"

        tmp_dir = Path(tempfile.mkdtemp(prefix="downvid_dl_"))
        out_path = download_to_file(url=req.url, selector=selector, out_dir=tmp_dir, timeout_s=900)

        # Cleanup entire temp dir after response
        def _cleanup_dir():
            try:
                for p in tmp_dir.iterdir():
                    try:
                        p.unlink(missing_ok=True)
                    except Exception:
                        pass
                tmp_dir.rmdir()
            except Exception:
                pass

        background.add_task(_cleanup_dir)

        title = str(info.get("title") or "downvid").strip() or "downvid"
        filename = out_path.name
        admin_log.add("download_completed", {"title": title, "filename": filename, "selector": selector})
        return FileResponse(
            path=str(out_path),
            filename=filename,
            media_type="application/octet-stream",
            background=BackgroundTask(background),
        )
    except YtDlpError as e:
        admin_log.add("download_error", {"url": req.url, "error": str(e)})
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        admin_log.add("download_error", {"url": req.url, "error": str(e)})
        raise HTTPException(status_code=500, detail="Download failed")


@router.get("/download")
async def download_help():
    return {
        "detail": "Use POST /api/download with JSON { url, selected_format_id, mode }.",
        "example": {"url": "https://...", "selected_format_id": "137", "mode": "video"},
    }


@router.get("/diagnostics")
async def diagnostics():
    return {
        "yt_dlp_cli": True,
        "has_ffmpeg": has_ffmpeg(),
        "serverless": is_serverless_runtime(),
        "supabase_enabled": settings.SUPABASE_ENABLED,
        "supabase_url_set": bool((settings.SUPABASE_URL or "").strip()),
        "supabase_service_role_key_set": bool((settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()),
        "cookies_env_set": bool(
            (os.getenv("YTDLP_COOKIES_B64") or "").strip()
            or (os.getenv("YTDLP_COOKIES_PATH") or "").strip()
            or (os.getenv("YTDLP_COOKIES_FROM_BROWSER") or "").strip()
        ),
        "cookies": cookies_env_diagnostics(),
        "proxy_set": bool((os.getenv("YTDLP_PROXY") or "").strip()),
    }
