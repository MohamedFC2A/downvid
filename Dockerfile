# =============================================================================
# DOWNVID - Backend-only Dockerfile (Railway-ready)
# =============================================================================
# This image runs ONLY the FastAPI backend (yt-dlp + download endpoints).
# Frontend is expected to be deployed separately (e.g., Vercel) and point to this backend via
# NEXT_PUBLIC_BACKEND_URL.
# =============================================================================

FROM python:3.11-slim AS production

# Install system dependencies
# - ffmpeg: required by yt-dlp for video/audio merging
# - curl: for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# yt-dlp (as of late 2025+) requires an external JS runtime for YouTube.
# Install Deno (lightweight and recommended by yt-dlp) for reliable extraction.
ARG DENO_VERSION=2.6.4
RUN curl -fsSL -o /tmp/deno.zip \
      https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/deno-x86_64-unknown-linux-gnu.zip \
    && unzip -q /tmp/deno.zip -d /usr/local/bin \
    && rm -f /tmp/deno.zip \
    && deno --version

WORKDIR /app

# Copy and install Python dependencies first (layer caching)
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt && \
    pip install --no-cache-dir --upgrade yt-dlp

# Copy backend source code
COPY backend/ ./backend/

# Create required directories
RUN mkdir -p /app/downloads

# Environment variables
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production
ENV DOWNLOADS_DIR=/app/downloads

# Expose the port
EXPOSE 8080

# Health check for container platforms
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/api/health || exit 1

# Run FastAPI with uvicorn
CMD ["sh", "-c", "cd /app/backend && python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
