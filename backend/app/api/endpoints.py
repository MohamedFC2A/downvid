from fastapi import APIRouter, Header, Request, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional
from pathlib import Path
from app.api.websocket import manager
from app.core.config import settings
from app.core.admin_log import admin_log
from app.core.auth import get_user_id_from_authorization, require_user_id, require_ultimate
from app.services.ytdlp_service import YtDlpService, VideoFormat
from app.services.deepseek_service import deepseek_service
from app.services.replicate_upscale_service import MODEL_MAP, replicate_upscale_service
from app.services.supabase_service import supabase_service
import yt_dlp
import shutil
import os
import time

router = APIRouter()
ytdlp_service = YtDlpService()


# Health check endpoint for container platforms
@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "downvid-api"}


def _public_base_url(request: Request) -> str:
    configured = (settings.PUBLIC_BASE_URL or "").strip()
    if configured:
        return configured.rstrip("/")
    proto = (request.headers.get("x-forwarded-proto") or request.url.scheme or "http").split(",")[0].strip()
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc).split(",")[0].strip()
    return f"{proto}://{host}"


def _cleanup_old_downloads(downloads_dir: Path) -> None:
    ttl_hours = int(getattr(settings, "DOWNLOAD_TTL_HOURS", 0) or 0)
    if ttl_hours <= 0:
        return
    cutoff = time.time() - (ttl_hours * 60 * 60)
    try:
        for p in downloads_dir.iterdir():
            if not p.is_file():
                continue
            try:
                if p.stat().st_mtime < cutoff:
                    p.unlink(missing_ok=True)
            except Exception:
                continue
    except Exception:
        # Cleanup must never block requests.
        return

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

class AnalyzeResponse(BaseModel):
    title: str
    thumbnail: Optional[str]
    description: Optional[str]
    analysis: Optional[dict]
    available_formats: List[VideoFormat]
    audio_formats: List[VideoFormat]

class SummarizeRequest(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def _validate_url3(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("URL is required")
        if len(v) > 2048:
            raise ValueError("URL is too long")
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return v


class DiagnoseRequest(BaseModel):
    stage: str
    url: str
    error: str
    context: dict = {}

    @field_validator("stage")
    @classmethod
    def _validate_stage(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in {"analyze", "download", "ws", "other"}:
            return "other"
        return v

    @field_validator("url")
    @classmethod
    def _validate_url2(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            return ""
        if len(v) > 2048:
            return v[:2048]
        return v

    @field_validator("error")
    @classmethod
    def _validate_error(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > 5000:
            return v[:5000]
        return v

@router.websocket("/download/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"WebSocket connection attempt from client: {client_id}")

    access_token = websocket.query_params.get("access_token")
    user_id = None
    if access_token:
        user_id = get_user_id_from_authorization(f"Bearer {access_token}")
    
    await manager.connect(websocket, client_id)
    logger.info(f"WebSocket connected: {client_id}")
    admin_log.add("ws_connected", {"client_id": client_id})
    
    try:
        while True:
            data = await websocket.receive_json()
            logger.debug(f"Received from {client_id}: {data}")
            
            # Expecting: { action: "start_download", url: "...", format_id: "...", mode: "video"|"audio" }
            if data.get("action") == "start_download":
                if settings.SUPABASE_ENABLED and not user_id:
                    await manager.send_personal_message(
                        {"status": "error", "error": "Login required to download (Supabase)"},
                        client_id,
                    )
                    continue

                url = (data.get("url") or "").strip()
                format_id = data.get("format_id")
                mode = data.get("mode", "video")
                container = data.get("container")
                height = data.get("height")
                
                if url and (url.startswith("http://") or url.startswith("https://")):
                    if settings.SUPABASE_ENABLED and user_id:
                        try:
                            quota = await supabase_service.consume_download(user_id)
                            if not bool(quota.get("allowed")):
                                remaining = quota.get("downloads_remaining")
                                await manager.send_personal_message(
                                    {
                                        "status": "error",
                                        "error": f"FREE limit reached (5 downloads). Remaining: {remaining}",
                                    },
                                    client_id,
                                )
                                continue
                        except Exception as e:
                            await manager.send_personal_message(
                                {"status": "error", "error": f"Subscription check failed: {e}"},
                                client_id,
                            )
                            continue

                    logger.info(f"Starting download for {client_id}: {url}")
                    await ytdlp_service.download_video(
                        url=url,
                        client_id=client_id,
                        format_id=format_id,
                        mode=mode,
                        container=container,
                        height=height,
                    )
                else:
                    await manager.send_personal_message({
                        "status": "error",
                        "error": "Invalid URL"
                    }, client_id)
            
            # Legacy fallback
            elif "url" in data and "action" not in data:
                pass

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {client_id}")
        manager.disconnect(client_id)
        admin_log.add("ws_disconnected", {"client_id": client_id})
    except Exception as e:
        logger.error(f"WebSocket error for {client_id}: {e}")
        manager.disconnect(client_id)
        admin_log.add("ws_error", {"client_id": client_id, "error": str(e)})

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_video(
    request: AnalyzeRequest,
    ai: bool = True,
    lang: str = "ar",
    authorization: str | None = Header(default=None),
):
    try:
        if ai and settings.SUPABASE_ENABLED:
            user_id = require_user_id(authorization)
            profile = await supabase_service.get_or_create_profile(user_id)
            require_ultimate(profile.ai_enabled)

        # 1. Get Metadata & Formats
        info = await ytdlp_service.get_video_info(request.url)
        title = info.get('title', 'Unknown Title')
        description = info.get('description', 'No description')
        
        analysis = None
        if ai:
            # 2. AI Process
            lang_norm = (lang or "ar").strip().lower()
            if lang_norm not in ("ar", "en"):
                lang_norm = "ar"
            analysis = await deepseek_service.analyze_metadata(title, description, lang=lang_norm)
        
        admin_log.add(
            "analyze",
            {
                "title": title,
                "extractor": info.get("extractor"),
                "id": info.get("id"),
                "formats_count": info.get("formats_count"),
                "video_formats": info.get("available_formats", [])[:10],
                "audio_formats": info.get("audio_formats", [])[:10],
            },
        )

        return {
            "title": title,
            "thumbnail": info.get('thumbnail'),
            "description": description,
            "analysis": analysis,
            "available_formats": info.get("available_formats", []),
            "audio_formats": info.get("audio_formats", [])
        }
    except Exception as e:
        msg = str(e)
        admin_log.add("analyze_error", {"url": request.url, "error": msg})
        if msg.startswith("RapidAPI provider failed:"):
            raise HTTPException(
                status_code=502,
                detail=(
                    "RapidAPI provider failed. "
                    "Fix: verify RAPIDAPI_KEY, RAPIDAPI_HOST, and RAPIDAPI_SNAP_HOST; "
                    "check RapidAPI quota/limits; then retry."
                ),
            )
        # YouTube bot-check / sign-in challenge
        if "confirm you" in msg.lower() and "not a bot" in msg.lower():
            raise HTTPException(
                status_code=400,
                detail=(
                    "YouTube requires sign-in verification (not-a-bot check). "
                    "Fix: provide cookies (YTDLP_COOKIES_PATH or YTDLP_COOKIES_B64) "
                    "and/or use a residential proxy (YTDLP_PROXY). "
                    "Check /api/diagnostics to confirm cookies are detected."
                ),
            )
        # Provide actionable hints for the most common YouTube extractor failure
        if "Failed to extract any player response" in msg or "player response" in msg.lower():
            raise HTTPException(
                status_code=400,
                detail=(
                    "YouTube extraction failed (no player response). "
                    "Fix: ensure yt-dlp is updated, a JS runtime is available (Deno), "
                    "and provide cookies if needed (YTDLP_COOKIES_PATH or YTDLP_COOKIES_B64). "
                    "Check /api/diagnostics for runtime status."
                ),
            )
        raise HTTPException(status_code=400, detail=msg)


@router.post("/summarize")
async def summarize_video(
    req: SummarizeRequest,
    ai: bool = True,
    lang: str = "ar",
    authorization: str | None = Header(default=None),
):
    """
    User-triggered "Summarize video" action.
    Best-effort: tries transcript via yt-dlp subtitles; falls back to metadata.
    """
    info = await ytdlp_service.get_video_info(req.url)
    title = info.get("title") or "Video"
    description = info.get("description") or ""

    lang_norm = (lang or "ar").strip().lower()
    if lang_norm not in ("ar", "en"):
        lang_norm = "ar"

    transcript_text = await ytdlp_service.get_transcript_text(req.url, lang=lang_norm)
    if not ai:
        return {
            "source": "metadata_fallback",
            "summary": [],
            "key_moments": [],
            "takeaways": [],
            "hashtags": [],
            "topics": [],
            "notes": "AI disabled",
        }

    if settings.SUPABASE_ENABLED:
        user_id = require_user_id(authorization)
        profile = await supabase_service.get_or_create_profile(user_id)
        require_ultimate(profile.ai_enabled)

    result = await deepseek_service.summarize_video(
        title=title,
        description=description,
        transcript_text=transcript_text,
        lang=lang_norm,
    )
    result["title"] = title
    result["has_transcript"] = bool(transcript_text)
    return result


@router.get("/admin/logs")
async def get_admin_logs(
    limit: int = 200,
    x_admin_token: str | None = Header(default=None),
):
    if settings.ADMIN_TOKEN and x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")
    # clamp to avoid huge payloads
    limit = max(1, min(500, int(limit)))
    return {"items": admin_log.list(limit=limit)}


@router.get("/diagnostics")
async def diagnostics():
    """Lightweight runtime diagnostics (no secrets)."""
    ytdlp_version = getattr(getattr(yt_dlp, "version", None), "__version__", None)
    env_cookie_path = (os.getenv("YTDLP_COOKIES_PATH") or "").strip()
    env_cookie_b64 = (os.getenv("YTDLP_COOKIES_B64") or "").strip()
    cookies_path = Path(env_cookie_path) if env_cookie_path else Path("backend/cookies.txt")
    if not cookies_path.exists():
        cookies_path = Path("cookies.txt")
    has_cookie_file = cookies_path.exists()
    return {
        "yt_dlp_version": ytdlp_version,
        "has_deno": shutil.which("deno") is not None,
        "has_ffmpeg": shutil.which("ffmpeg") is not None,
        "download_provider": (settings.DOWNLOAD_PROVIDER or "ytdlp"),
        "rapidapi_configured": bool((settings.RAPIDAPI_KEY or "").strip()),
        "rapidapi_host": (settings.RAPIDAPI_HOST or ""),
        "rapidapi_snap_host": (settings.RAPIDAPI_SNAP_HOST or ""),
        "cookies_env_set": bool(env_cookie_b64 or env_cookie_path),
        "cookies_file_found": has_cookie_file,
        "proxy_set": bool((os.getenv("YTDLP_PROXY") or "").strip()),
        "force_ipv4": (os.getenv("YTDLP_FORCE_IPV4") or "").strip().lower() in ("1", "true", "yes"),
        "force_ipv6": (os.getenv("YTDLP_FORCE_IPV6") or "").strip().lower() in ("1", "true", "yes"),
    }


@router.post("/ai/diagnose")
async def ai_diagnose(req: DiagnoseRequest, authorization: str | None = Header(default=None)):
    if settings.SUPABASE_ENABLED:
        user_id = require_user_id(authorization)
        profile = await supabase_service.get_or_create_profile(user_id)
        require_ultimate(profile.ai_enabled)
    if not settings.DEEPSEEK_API_KEY:
        raise HTTPException(status_code=503, detail="DEEPSEEK_API_KEY is not configured on the server")
    # Attach a small amount of recent admin logs for context (sanitized)
    recent = admin_log.list(limit=30)
    ytdlp_version = getattr(getattr(yt_dlp, "version", None), "__version__", None)
    context = {
        "runtime": {
            "yt_dlp_version": ytdlp_version,
            "has_deno": shutil.which("deno") is not None,
            "has_ffmpeg": shutil.which("ffmpeg") is not None,
        },
        "recent_events": recent,
        "client_context": req.context or {},
    }

    admin_log.add("ai_diagnose_request", {"stage": req.stage, "url": req.url, "error": req.error[:300]})
    result = await deepseek_service.diagnose_error(stage=req.stage, url=req.url, error=req.error, context=context)
    admin_log.add("ai_diagnose_result", {"stage": req.stage, "root_cause": result.get("root_cause"), "confidence": result.get("confidence")})
    return result


@router.get("/ai/diagnose")
async def ai_diagnose_get(
    stage: str = "other",
    url: str = "",
    error: str = "",
    authorization: str | None = Header(default=None),
):
    """
    GET fallback for environments where POST is blocked/misrouted.
    Note: URL + error are truncated server-side by validation in DiagnoseRequest.
    """
    req = DiagnoseRequest(stage=stage, url=url, error=error, context={})
    return await ai_diagnose(req, authorization=authorization)


class UpscaleRequest(BaseModel):
    model_config = {"populate_by_name": True}

    file_token: Optional[str] = Field(default=None, alias="fileToken")
    video_url: Optional[str] = Field(default=None, alias="videoUrl")
    model: Optional[str] = None

    @model_validator(mode="after")
    def _validate(self):
        if not (self.file_token or self.video_url):
            raise ValueError("fileToken or videoUrl is required")
        return self


@router.get("/upscale")
async def upscale_info():
    return {
        "enabled": bool((settings.REPLICATE_API_TOKEN or "").strip()),
        "models": sorted(list(MODEL_MAP.keys())),
    }


@router.post("/upscale")
async def upscale_start(payload: UpscaleRequest, request: Request, authorization: str | None = Header(default=None)):
    if settings.SUPABASE_ENABLED:
        user_id = require_user_id(authorization)
        profile = await supabase_service.get_or_create_profile(user_id)
        require_ultimate(profile.ai_enabled)

    source_url = (payload.video_url or "").strip()
    if not source_url:
        file_token = (payload.file_token or "").strip()
        if not file_token:
            raise HTTPException(status_code=400, detail="fileToken or videoUrl is required")

        downloads_dir = Path(settings.DOWNLOADS_DIR)
        files = sorted(downloads_dir.glob(f"{file_token}_*"))
        if not files:
            raise HTTPException(status_code=404, detail="File not found. Download the video first, then upscale using fileToken.")

        base = _public_base_url(request)
        source_url = f"{base}/api/file/serve/{file_token}"

    try:
        prediction = await replicate_upscale_service.create_prediction(source_url=source_url, model_key=payload.model)
        return {"predictionId": prediction.get("id"), "status": prediction.get("status")}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/upscale/status/{prediction_id}")
async def upscale_status(prediction_id: str, authorization: str | None = Header(default=None)):
    if settings.SUPABASE_ENABLED:
        user_id = require_user_id(authorization)
        profile = await supabase_service.get_or_create_profile(user_id)
        require_ultimate(profile.ai_enabled)
    try:
        prediction = await replicate_upscale_service.get_prediction(prediction_id)
        raw_status = prediction.get("status")
        output = prediction.get("output")
        if isinstance(output, list) and output:
            output = output[-1]

        status = "processing"
        if raw_status == "succeeded":
            status = "succeeded"
        elif raw_status in ("failed", "canceled"):
            status = "failed"

        return {
            "status": status,
            "rawStatus": raw_status,
            "output": output,
            "error": prediction.get("error"),
        }
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/file/serve/{file_token}")
async def serve_file(file_token: str):
    try:
        downloads_dir = Path(settings.DOWNLOADS_DIR)
        _cleanup_old_downloads(downloads_dir)
        # Look for file in downloads folder starting with token
        files = sorted(downloads_dir.glob(f"{file_token}_*"))
        
        if not files:
            raise HTTPException(status_code=404, detail="File not found")
            
        filepath = files[0]
        filename = filepath.name
        # Remove the token prefix for the download name if desired, or keep it unique. 
        # Let's remove the token prefix for the user implementation: {token}_{title}.ext
        # {file_token}_ prefix length is len(file_token)+1
        download_name = filename[len(file_token)+1:]

        return FileResponse(
            str(filepath), 
            filename=download_name,
        )
    except Exception as e:
        print(f"Serve error: {e}")
        raise HTTPException(status_code=404, detail="File not found")


@router.get("/me")
async def get_me(authorization: str | None = Header(default=None)):
    """
    Returns the current user's subscription/usage information (Supabase).
    """
    if not settings.SUPABASE_ENABLED:
        return {
            "supabase_enabled": False,
            "plan": "ultimate",
            "downloads_used": 0,
            "downloads_remaining": None,
            "ai_enabled": True,
        }

    user_id = require_user_id(authorization)
    profile = await supabase_service.get_or_create_profile(user_id)
    return {
        "supabase_enabled": True,
        "user_id": profile.user_id,
        "plan": profile.effective_plan,
        "downloads_used": profile.downloads_used,
        "downloads_remaining": profile.downloads_remaining,
        "ai_enabled": profile.ai_enabled,
        "ultimate_until": profile.ultimate_until,
    }


class AdminSetPlanRequest(BaseModel):
    user_id: str
    plan: str


@router.post("/admin/set-plan")
async def admin_set_plan(payload: AdminSetPlanRequest, x_admin_token: str | None = Header(default=None)):
    if settings.ADMIN_TOKEN and x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        profile = await supabase_service.set_plan(user_id=payload.user_id, plan=payload.plan)
        return {
            "user_id": profile.user_id,
            "plan": profile.effective_plan,
            "downloads_used": profile.downloads_used,
            "downloads_remaining": profile.downloads_remaining,
            "ai_enabled": profile.ai_enabled,
            "ultimate_until": profile.ultimate_until,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class PromoRedeemRequest(BaseModel):
    code: str


@router.post("/promo/redeem")
async def redeem_promo(payload: PromoRedeemRequest, authorization: str | None = Header(default=None)):
    if not settings.SUPABASE_ENABLED:
        return {"success": True, "message": "Supabase disabled", "plan": "ultimate", "ultimate_until": None}

    user_id = require_user_id(authorization)
    result = await supabase_service.redeem_promo_code(user_id=user_id, code=(payload.code or "").strip())
    # Return fresh entitlements after redeem attempt
    profile = await supabase_service.get_or_create_profile(user_id)
    return {
        "success": bool(result.get("success")),
        "message": result.get("message") or "",
        "plan": profile.effective_plan,
        "ai_enabled": profile.ai_enabled,
        "ultimate_until": profile.ultimate_until,
        "downloads_used": profile.downloads_used,
        "downloads_remaining": profile.downloads_remaining,
    }
