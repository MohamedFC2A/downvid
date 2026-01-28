import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "DOWNVID"
    API_V1_STR: str = "/api"
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_API_URL: str = "https://api.deepseek.com/v1/chat/completions" # Verify endpoint

    # Storage paths (override via env for container deployments)
    FRONTEND_PATH: str = os.getenv(
        "FRONTEND_PATH",
        str(Path(__file__).resolve().parents[3] / "frontend" / "out"),
    )
    DOWNLOADS_DIR: str = os.getenv(
        "DOWNLOADS_DIR",
        str(Path(__file__).resolve().parents[3] / "downloads"),
    )

    # Admin/debug
    ADMIN_TOKEN: str = os.getenv("ADMIN_TOKEN", "")
    
settings = Settings()
