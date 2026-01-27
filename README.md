# DOWNVID V2.0 🚀

**DOWNVID** is a professional, industrial-grade video extraction and analysis platform. Rebuilt from the ground up for high performance, it features a strict "Monochromatic Dark Mode" aesthetic, real-time WebSocket progress tracking, and DeepSeek V3 AI intelligence.

![V2.0 Interface](https://via.placeholder.com/800x450?text=DOWNVID+V2.0+Professional+Interface)

## ✨ Key Features

*   **🎨 Pro Industrial Design**: Monochromatic zinc/black palette with subtle subtle grid backgrounds and spotlight effects. No blurry glassmorphism.
*   **⚡ Real-Time Progress**: WebSocket-powered progress bars that update instantly without polling.
*   **🧠 DeepSeek AI Intelligence**: Automatically analyzes video metadata to provide summaries (in Arabic), sentiment analysis, and viral hashtags.
*   **🏗️ Modular Architecture**: Clean separation of concerns with a dedicated `downloader` and `ai` modules.
*   **🔐 Type-Safe**: Full TypeScript frontend and Python FastAPI backend with Pydantic validation.

## 🛠️ Tech Stack

### Frontend (`/frontend`)
*   **Framework**: Next.js 14 (App Router)
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS v4 (Zinc Palette)
*   **Animations**: Framer Motion
*   **Primitives**: Custom "Spotlight" UI components

### Backend (`/backend`)
*   **Framework**: FastAPI (Python)
*   **Engine**: yt-dlp (Custom Progress Hooks)
*   **Real-time**: WebSockets
*   **AI**: DeepSeek V3 API
*   **Task Management**: Asyncio

## 🚀 Getting Started

### Prerequisites
*   Node.js 18+
*   Python 3.9+
*   DeepSeek API Key

### Quick Start (Windows)
We provide a unified startup script for convenience.

1.  **Clone the Repo**:
    ```bash
    git clone https://github.com/your-repo/DOWNVID.git
    cd DOWNVID
    ```

2.  **Configure Environment**:
    *   Create `backend/.env` file.
    *   Add your key: `DEEPSEEK_API_KEY=your_key_here`

3.  **Run Everything**:
    Double-click `start.bat`
    *   *This will set up the backend virtual environment, install dependencies, and launch both servers.*

### Manual Setup

**Backend:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
# Server runs at http://localhost:8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# App runs at http://localhost:3000
```

## 🚆 Deploy on Railway

Railway can deploy this repo directly using the included `Dockerfile` (single service: FastAPI serves the static Next.js export).

1. Create a new Railway project → **Deploy from GitHub repo**
2. Ensure Railway detects the `Dockerfile` (or it will use `railway.json`)
3. Set environment variables:
   - `DEEPSEEK_API_KEY` (required for AI features)
4. Deploy — Railway will provide a public URL (the app listens on `PORT` automatically)

## 📂 Project Structure

```text
/
├── start.bat               # Unified Launcher
├── /frontend               # Next.js Application
│   ├── /app
│   │   ├── /tool           # Main Downloader Interface
│   │   └── globals.css     # Dark Mode Theme
│   ├── /components
│   │   ├── /modules
│   │   │   ├── /downloader # Input, Preview, Progress
│   │   │   └── /ai         # Insights Panel
│   │   └── /ui             # Atomic Components (Card, Button)
│   └── /lib
│       └── socket.ts       # WebSocket Client
├── /backend                # FastAPI Server
│   ├── /app
│   │   ├── /api            # Endpoints & WS Manager
│   │   ├── /services       # YtDlp & DeepSeek Logic
│   │   └── main.py         # Entry Point
│   └── requirements.txt
```

## 🔌 API Endpoints

### `POST /api/analyze`
Extracts metadata and triggers AI analysis.
*   **Input**: `{ "url": "https://..." }`
*   **Output**: `{ "title": "...", "thumbnail": "...", "analysis": { ... } }`

```text
/
├── start.bat               # Unified Launcher
├── /frontend               # Next.js Application
│   ├── /app
│   │   ├── /tool           # Main Downloader Interface
│   │   └── globals.css     # Dark Mode Theme
│   ├── /components
│   │   ├── /modules
│   │   │   ├── /downloader # Input, Preview, Progress
│   │   │   └── /ai         # Insights Panel
│   │   └── /ui             # Atomic Components (Card, Button)
│   └── /lib
│       └── socket.ts       # WebSocket Client
├── /backend                # FastAPI Server
│   ├── /app
│   │   ├── /api            # Endpoints & WS Manager
│   │   ├── /services       # YtDlp & DeepSeek Logic
│   │   └── main.py         # Entry Point
│   └── requirements.txt
```

## 🔌 API Endpoints

### `POST /api/analyze`
Extracts metadata and triggers AI analysis.
*   **Input**: `{ "url": "https://..." }`
*   **Output**: `{ "title": "...", "thumbnail": "...", "analysis": { ... } }`

### `WS /api/download/{client_id}`
Real-time download stream.
*   **Message**: `{ "url": "https://..." }`
*   **Updates**: `{ "status": "downloading", "percent": 45, "speed": "2.5MB/s" }`

---

## 🌐 Deployment Guide (Free Tier Strategy)

Maximize resources by splitting the app between Vercel (Frontend) and Render (Backend).

### 1. Backend (Render Free)
*   **Create New Web Service** on [Render](https://render.com).
*   **Connect GitHub Repo**.
*   **Root Directory**: `.` (or leave empty)
*   **Build Command**: `pip install -r backend/requirements.txt`
*   **Start Command**: `python -m uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
*   **Environment Variables**:
    *   `DEEPSEEK_API_KEY`: Your key.
    *   `PYTHON_VERSION`: `3.11.0`

> **Note**: Free tier spins down after inactivity. The first request might take 50s.

### 2. Frontend (Vercel)
*   **Import Project** on [Vercel](https://vercel.com).
*   **Root Directory**: `frontend`.
*   **Build Command**: `next build` (default).
*   **Output Directory**: `out` (default).
*   **Environment Variables**:
    *   `NEXT_PUBLIC_BACKEND_URL`: `https://your-render-app-name.onrender.com`
    *   `NEXT_PUBLIC_WS_URL`: `wss://your-render-app-name.onrender.com` (Optional, derived automatically)

### 3. Alternative: Single Service (Railway/Fly.io)
Deploy the entire repo using the included `Dockerfile`.
*   **Railway**: Detects verify Dockerfile automatically.
*   **Environment**: Set `DEEPSEEK_API_KEY`.

---
**DOWNVID V2.0** — *Professional Extraction Pipeline*
