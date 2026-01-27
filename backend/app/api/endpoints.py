from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from pydantic import BaseModel
from typing import List, Optional
import os
import glob
from app.api.websocket import manager
from app.services.ytdlp_service import YtDlpService, VideoFormat
from app.services.deepseek_service import deepseek_service

router = APIRouter()
ytdlp_service = YtDlpService()


# Health check endpoint for Fly.io container health monitoring
@router.get("/health")
async def health_check():
    """Health check endpoint for Fly.io."""
    return {"status": "healthy", "service": "downvid-api"}

class AnalyzeRequest(BaseModel):
    url: str

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
    
    try:
        while True:
            data = await websocket.receive_json()
            logger.debug(f"Received from {client_id}: {data}")
            
            # Expecting: { action: "start_download", url: "...", format_id: "...", mode: "video"|"audio" }
            if data.get("action") == "start_download":
                url = data.get("url")
                format_id = data.get("format_id")
                mode = data.get("mode", "video")
                
                if url and format_id:
                    logger.info(f"Starting download for {client_id}: {url}")
                    await ytdlp_service.download_video(url, client_id, format_id, mode)
                else:
                    await manager.send_personal_message({
                        "status": "error",
                        "error": "Missing url or format_id"
                    }, client_id)
            
            # Legacy fallback
            elif "url" in data and "action" not in data:
                pass

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {client_id}")
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for {client_id}: {e}")
        manager.disconnect(client_id)

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_video(request: AnalyzeRequest):
    try:
        # 1. Get Metadata & Formats
        info = await ytdlp_service.get_video_info(request.url)
        title = info.get('title', 'Unknown Title')
        description = info.get('description', 'No description')
        
        # 2. AI Process
        analysis = await deepseek_service.analyze_metadata(title, description)
        
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

@router.get("/file/serve/{file_token}")
async def serve_file(file_token: str):
    try:
        # Look for file in downloads folder starting with token
        search_pattern = f"downloads/{file_token}_*"
        files = glob.glob(search_pattern)
        
        if not files:
            raise HTTPException(status_code=404, detail="File not found")
            
        filepath = files[0]
        filename = os.path.basename(filepath)
        # Remove the token prefix for the download name if desired, or keep it unique. 
        # Let's remove the token prefix for the user implementation: {token}_{title}.ext
        # {file_token}_ prefix length is len(file_token)+1
        download_name = filename[len(file_token)+1:]
        
        def cleanup():
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
            except Exception as e:
                print(f"Error cleaning up {filepath}: {e}")

        return FileResponse(
            filepath, 
            filename=download_name, 
            background=BackgroundTask(cleanup)
        )
    except Exception as e:
        print(f"Serve error: {e}")
        raise HTTPException(status_code=404, detail="File not found")
