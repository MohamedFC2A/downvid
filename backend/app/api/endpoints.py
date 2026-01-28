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
        raise HTTPException(status_code=400, detail=str(e))


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
