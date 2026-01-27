# Quick Start Guide for GlassLoad AI

## 🚀 Quick Setup (First Time)

### 1. Backend Setup
```powershell
cd C:\Projects\DOWNVID\backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

**Important**: Copy `.env.example` to `.env` and add your DeepSeek API key:
```powershell
copy .env.example .env
# Edit .env file and add your DEEPSEEK_API_KEY
```

### 2. Frontend Setup
```powershell
cd C:\Projects\DOWNVID\frontend
npm install
```

## ▶️ Running the App (Every Time)

### Terminal 1 - Backend
```powershell
cd C:\Projects\DOWNVID\backend
.\venv\Scripts\activate
python main.py
```
✅ Backend will run on: http://localhost:8000

### Terminal 2 - Frontend
```powershell
cd C:\Projects\DOWNVID\frontend
npm run dev
```
✅ Frontend will run on: http://localhost:3000

## 🌐 Access the App
Open your browser and go to: **http://localhost:3000**

## 📋 What You Need
- ✅ Python 3.9+ installed
- ✅ Node.js 18+ installed
- ✅ DeepSeek API key (get from https://platform.deepseek.com/)

## 🎯 Testing the App

1. **Paste a video URL** (YouTube, TikTok, or Instagram)
2. **Click "Analyze"** - the app will fetch video metadata
3. **Click "Smart Insights"** - get AI-powered summary and hashtags in Arabic
4. **Select format and quality**, then click "Download"

## 🐛 Troubleshooting

**Backend won't start?**
- Make sure you activated the virtual environment
- Check if Python is installed: `python --version`
- Verify all dependencies are installed: `pip list`

**Frontend won't start?**
- Make sure you ran `npm install`
- Delete `node_modules` and `.next` folders, then run `npm install` again

**API not connecting?**
- Ensure both backend (8000) and frontend (3000) are running
- Check `.env` files in both directories
- Verify CORS settings in `backend/main.py`

**DeepSeek API errors?**
- Verify your API key in `backend/.env`
- Check your DeepSeek account has credits
- Test API key directly at https://platform.deepseek.com/

## 📁 Project Structure
```
DOWNVID/
├── frontend/          # Next.js app
│   ├── app/          # Pages and API routes
│   ├── components/   # UI components
│   └── .env.local    # Frontend config
├── backend/          # FastAPI server
│   ├── main.py       # Main API file
│   ├── .env          # Backend config (create from .env.example)
│   └── requirements.txt
└── README.md
```

## 🎨 Key Features
- ✨ Liquid Glassmorphism UI
- 🌊 Animated Aurora background
- 🤖 AI-powered insights (Arabic)
- 📱 Fully responsive
- ⚡ Real-time platform detection

---
Happy downloading! 🎉
