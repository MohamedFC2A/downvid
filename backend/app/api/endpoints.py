from fastapi import APIRouter, Header, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from pydantic import BaseModel, field_validator
from typing import List, Optional
from pathlib import Path
from app.api.websocket import manager
from app.core.config import settings
from app.core.admin_log import admin_log
from app.services.ytdlp_service import YtDlpService, VideoFormat
from app.services.deepseek_service import deepseek_service
import yt_dlp
import shutil
import os

router = APIRouter()
ytdlp_service = YtDlpService()


# Health check endpoint for container platforms
@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "downvid-api"}

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
    analysis: dict
    available_formats: List[VideoFormat]
    audio_formats: List[VideoFormat]


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
    
    await manager.connect(websocket, client_id)
    logger.info(f"WebSocket connected: {client_id}")
    admin_log.add("ws_connected", {"client_id": client_id})
    
    try:
        while True:
            data = await websocket.receive_json()
            logger.debug(f"Received from {client_id}: {data}")
            
            # Expecting: { action: "start_download", url: "...", format_id: "...", mode: "video"|"audio" }
            if data.get("action") == "start_download":
                url = (data.get("url") or "").strip()
                format_id = data.get("format_id")
                mode = data.get("mode", "video")
                container = data.get("container")
                height = data.get("height")
                
                if url and (url.startswith("http://") or url.startswith("https://")):
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
async def analyze_video(request: AnalyzeRequest):
    try:
        # 1. Get Metadata & Formats
        info = await ytdlp_service.get_video_info(request.url)
        title = info.get('title', 'Unknown Title')
        description = info.get('description', 'No description')
        
        # 2. AI Process
        analysis = await deepseek_service.analyze_metadata(title, description)
        
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
        "cookies_env_set": bool(env_cookie_b64 or env_cookie_path),
        "cookies_file_found": has_cookie_file,
        "proxy_set": bool((os.getenv("YTDLP_PROXY") or "").strip()),
        "force_ipv4": (os.getenv("YTDLP_FORCE_IPV4") or "").strip().lower() in ("1", "true", "yes"),
        "force_ipv6": (os.getenv("YTDLP_FORCE_IPV6") or "").strip().lower() in ("1", "true", "yes"),
    }


@router.post("/ai/diagnose")
async def ai_diagnose(req: DiagnoseRequest):
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
):
    """
    GET fallback for environments where POST is blocked/misrouted.
    Note: URL + error are truncated server-side by validation in DiagnoseRequest.
    """
    req = DiagnoseRequest(stage=stage, url=url, error=error, context={})
    return await ai_diagnose(req)

@router.get("/file/serve/{file_token}")
async def serve_file(file_token: str):
    try:
        downloads_dir = Path(settings.DOWNLOADS_DIR)
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
        
        def cleanup():
            try:
                if filepath.exists():
                    filepath.unlink()
            except Exception as e:
                print(f"Error cleaning up {filepath}: {e}")

        return FileResponse(
            str(filepath), 
            filename=download_name, 
            background=BackgroundTask(cleanup)
        )
    except Exception as e:
        print(f"Serve error: {e}")
        raise HTTPException(status_code=404, detail="File not found")
