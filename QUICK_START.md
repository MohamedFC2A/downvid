# GlassLoad AI - Quick Start Guide

## 🚀 Fast Setup (First Time Only)

### 1. Backend Setup
Open PowerShell and run:

```powershell
cd C:\Projects\DOWNVID\backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

**IMPORTANT**: Copy `.env.example` to `.env`:
```powershell
copy .env.example .env
```

Then edit `.env` file and add your DeepSeek API key:
```
DEEPSEEK_API_KEY=sk-your-actual-api-key-here
```

Get your API key from: https://platform.deepseek.com/

---

## 🔐 Supabase (Subscriptions)

This project supports 2 plans:
- **FREE**: 5 downloads, no AI features
- **Ultimate**: unlimited downloads + all AI features

### 1) Create tables/functions
In Supabase SQL Editor, run:
- `backend/supabase/schema.sql`

### 2) Backend env
Set these in `backend/.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
```

### 3) Frontend env
Set these in `frontend/.env.local` (or your platform env):
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 3.1) Promo codes (Ultimate for 30 days)
Add codes in Supabase SQL Editor (example):
```sql
insert into public.promo_codes (code, duration_days, active)
values ('DOWNVID-ULTIMATE-30', 30, true);
```

### 4) Google Sign-in (OAuth)
In Google Cloud Console, set **Authorized redirect URIs** to:
`https://rbihfnliubohjjmkssyi.supabase.co/auth/v1/callback`

In Supabase Dashboard:
- Authentication → Providers → Google: enable it
- Authentication → URL Configuration:
  - Add redirect URLs like `http://localhost:3000/auth/callback` and your production domain.

---

## ▶️ Running the App (Every Time)

### Option 1: Two Terminals

**Terminal 1 - Backend**:
```powershell
cd C:\Projects\DOWNVID\backend
.\venv\Scripts\activate
python main.py
```
✅ Wait until you see: `Uvicorn running on http://0.0.0.0:8000`

**Terminal 2 - Frontend**:
```powershell
cd C:\Projects\DOWNVID\frontend
npm run dev
```
✅ Frontend runs on: http://localhost:3000

---

### Option 2: Using Batch File (Windows)

Save this as `start.bat` in the root directory:

```batch
@echo off
echo Starting GlassLoad AI...
start cmd /k "cd backend && .\venv\Scripts\activate && python main.py"
timeout /t 3
start cmd /k "cd frontend && npm run dev"
echo Both servers starting...
pause
```

Then just double-click `start.bat`

---

## 🌐 Access the App
Open browser: **http://localhost:3000**

---

## 📋 Testing the App

1. Copy a video URL:
   - YouTube: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
   - TikTok: `https://www.tiktok.com/@username/video/...`
   - Instagram: `https://www.instagram.com/reel/...`

2. Paste into the input field
3. Click "Analyze Video"
4. Click "Smart AI Insights" for Arabic summary + hashtags
5. Select format (MP4/MP3) and quality
6. Click "Download"

---

## ✅ Checklist

- [ ] Python 3.9+ installed (`python --version`)
- [ ] Node.js 18+ installed (`node --version`)
- [ ] Backend dependencies installed (`pip list`)
- [ ] Frontend dependencies installed (`npm list`)
- [ ] DeepSeek API key in `backend/.env`
- [ ] Backend running on port 8000
- [ ] Frontend running on port 3000

---

## 🐛 Common Errors & Fixes

### "Cannot connect to backend"
**Cause**: Backend not running
**Fix**: Start backend first (`python main.py`)

### "Failed to analyze video"
**Causes**:
1. Invalid URL
2. Private video  
3. Video not available
**Fix**: Try a different public video URL

### "DeepSeek API error"
**Causes**:
1. API key missing or invalid
2. No credits in account
**Fix**: Check `.env` file and DeepSeek account

### Port already in use
**Fix**: 
```powershell
# Kill process on port 8000 (backend)
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Kill process on port 3000 (frontend)
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

## 🎨 What's New in the Redesign

- ✨ **Massive hero title** with gradient text and glow effects
- 🌊 **Enhanced animations** with 4 moving gradient orbs
- 💎 **Neon borders** on active inputs
- 🎯 **Better error messages** with quick fix suggestions
- 📱 **Improved mobile responsiveness**
- 🔥 **Premium button gradients** with hover effects
- ⚡ **Faster loading states** with shimmer effects

---

Happy downloading! 🎉
