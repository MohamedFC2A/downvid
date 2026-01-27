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
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_json()
            # Expecting: { action: "start_download", url: "...", format_id: "...", mode: "video"|"audio" }
            if data.get("action") == "start_download":
                url = data.get("url")
                format_id = data.get("format_id")
                mode = data.get("mode", "video")
                
                if url and format_id:
                    await ytdlp_service.download_video(url, client_id, format_id, mode)
            
            # Legacy fallback if just url (though we should strictly migrate)
            elif "url" in data and "action" not in data:
                 # Default to best video if no format specified? Or just ignore?
                 # Ignoring strictly as per new requirements to force format selection
                 pass

    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        print(f"WS Error: {e}")

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
