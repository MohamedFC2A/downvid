# =============================================================================
# DOWNVID - Optimized Multi-Stage Dockerfile for Fly.io
# =============================================================================
# Architecture: Single-process deployment
# - Next.js is built as static export (HTML/CSS/JS files)
# - FastAPI serves static files + API endpoints
# - Only FastAPI listens on $PORT (Fly.io requirement)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Frontend (Next.js Static Export)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files first for better layer caching
COPY frontend/package*.json ./

# Install dependencies (clean install for reproducibility)
RUN npm ci --prefer-offline --no-audit

# Copy frontend source code
COPY frontend/ ./

# Set production environment for build
ENV NODE_ENV=production
ENV NEXT_PUBLIC_BACKEND_URL=https://downvid.fly.dev
ENV NEXT_PUBLIC_WS_URL=wss://downvid.fly.dev

# Build Next.js as static export (outputs to 'out' directory)
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production Runtime (Python/FastAPI)
# -----------------------------------------------------------------------------
FROM python:3.11-slim AS production

# Install system dependencies
# - ffmpeg: required by yt-dlp for video/audio merging
# - curl: for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# Copy and install Python dependencies first (layer caching)
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source code
COPY backend/ ./backend/

# Copy built frontend static files from builder stage
COPY --from=frontend-builder /app/frontend/out ./frontend/out

# Create required directories
RUN mkdir -p /app/downloads

# Environment variables
# PORT: Fly.io dynamically assigns this (default 8080)
# PYTHONUNBUFFERED: Ensures logs appear in real-time
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production

# Expose the port (documentation only, Fly.io uses PORT env var)
EXPOSE 8080

# Health check for Fly.io
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/api/health || exit 1

# Run FastAPI with uvicorn
# - host 0.0.0.0: Accept connections from anywhere (required for containers)
# - port from $PORT: Fly.io dynamically assigns this
CMD ["sh", "-c", "cd /app/backend && python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]