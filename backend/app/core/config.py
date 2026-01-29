import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "DOWNVID"
    API_V1_STR: str = "/api"
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_API_URL: str = "https://api.deepseek.com/v1/chat/completions" # Verify endpoint

    # Replicate (AI Upscale)
    REPLICATE_API_TOKEN: str = os.getenv("REPLICATE_API_TOKEN", "")
    REPLICATE_MODEL: str = os.getenv("REPLICATE_MODEL", "")
    REPLICATE_MODEL_VERSION: str = os.getenv("REPLICATE_MODEL_VERSION", "")
    REPLICATE_MODEL_INPUT: str = os.getenv("REPLICATE_MODEL_INPUT", "")

    # Public base URL (optional). Used to build absolute URLs for external services
    # (e.g., Replicate fetching /api/file/serve/{token}).
    PUBLIC_BASE_URL: str = os.getenv("PUBLIC_BASE_URL", "")

    # RapidAPI (social-download-all-in-one)
    RAPIDAPI_KEY: str = os.getenv("RAPIDAPI_KEY", "")
    RAPIDAPI_HOST: str = os.getenv("RAPIDAPI_HOST", "social-download-all-in-one.p.rapidapi.com")
    RAPIDAPI_SNAP_HOST: str = os.getenv("RAPIDAPI_SNAP_HOST", "snap-video3.p.rapidapi.com")

    # Download/info provider: "ytdlp" (default) or "rapidapi"
    DOWNLOAD_PROVIDER: str = os.getenv("DOWNLOAD_PROVIDER", "ytdlp")

    # Storage paths (override via env for container deployments)
    FRONTEND_PATH: str = os.getenv(
        "FRONTEND_PATH",
        str(Path(__file__).resolve().parents[3] / "frontend" / "out"),
    )
    DOWNLOADS_DIR: str = os.getenv(
        "DOWNLOADS_DIR",
        str(Path(__file__).resolve().parents[3] / "downloads"),
    )

    # Downloads cleanup (hours). Files older than this may be deleted opportunistically.
    DOWNLOAD_TTL_HOURS: int = int(os.getenv("DOWNLOAD_TTL_HOURS", "6"))

    # Admin/debug
    ADMIN_TOKEN: str = os.getenv("ADMIN_TOKEN", "")

    # Supabase (Auth + subscriptions/usage)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    # Server-side key used for PostgREST/RPC calls. Keep secret.
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    # Optional: Used to verify Supabase JWTs locally (HS256). If not set, the backend will
    # validate access tokens by calling Supabase Auth API.
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")

    @property
    def SUPABASE_ENABLED(self) -> bool:
        return bool(
            (self.SUPABASE_URL or "").strip()
            and (self.SUPABASE_SERVICE_ROLE_KEY or "").strip()
        )
    
settings = Settings()
