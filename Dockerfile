# =============================================================================
# DOWNVID - Optimized Dockerfile for Fly.io Deployment
# =============================================================================
# Strategy: Run FastAPI backend on PORT, serve frontend via reverse proxy
# The frontend is built as static files and served through FastAPI
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Frontend (Next.js Static Export)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files first for layer caching
COPY frontend/package*.json ./
RUN npm ci

# Copy source and build as static export
COPY frontend/ ./

# Build Next.js (output: .next folder for standalone or out/ for static)
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production Runtime
# -----------------------------------------------------------------------------
FROM python:3.11-slim AS production

# Install system dependencies (ffmpeg for yt-dlp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# Install Python dependencies first (layer caching)
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend static files (if using static export)
# For Next.js standalone: copy .next/standalone and .next/static
COPY --from=frontend-builder /app/frontend/.next/standalone ./frontend/
COPY --from=frontend-builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/frontend/public ./frontend/public

# Create directories
RUN mkdir -p /app/downloads /app/backend/bin

# Environment
ENV PORT=8080
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

# Create startup script that runs both services
RUN echo '#!/bin/bash\n\
    cd /app/frontend && node server.js &\n\
    cd /app/backend && python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}\n\
    ' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 8080

CMD ["/bin/bash", "/app/start.sh"]