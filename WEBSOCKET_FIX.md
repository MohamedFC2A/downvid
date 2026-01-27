# 🚨 WebSocket Connection Issue - Quick Fix

## Problem
```
WebSocket error: {}
WebSocket connection error
```

This happens because the backend is running **old code** without WebSocket support.

---

## ✅ Solution (Follow in Order)

### Step 1: Stop the Current Backend
Find the terminal running the backend and press `Ctrl+C` to stop it.

### Step 2: Install New Dependencies

**Option A: If you have venv already**
```powershell
cd C:\Projects\DOWNVID\backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Option B: Fresh Setup**
```powershell
# Double-click this file:
C:\Projects\DOWNVID\setup-backend.bat
```

### Step 3: Restart Backend with NEW Code
```powershell
cd C:\Projects\DOWNVID\backend
.\venv\Scripts\Activate.ps1
python main.py
```

✅ **You should see**:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 4: Refresh Frontend
Refresh the page at http://localhost:3000

✅ **You should see** at the bottom:
```
🟢 WebSocket Connected
```

---

## 🔍 Verify Installation

After Step 2, check if websockets is installed:
```powershell
pip list | Select-String websockets
```

Expected output:
```
websockets    13.1
```

---

## ⚠️ Common Mistakes

❌ **Don't skip activating venv**
```powershell
.\venv\Scripts\Activate.ps1
```

❌ **Don't install in global Python**
You must be inside the virtual environment (you'll see `(venv)` at the start of your terminal line)

❌ **Don't use old terminal**
Close the old backend terminal and open a fresh one

---

## 📋 Complete Fresh Start (If All Else Fails)

```powershell
# 1. Stop everything
# Press Ctrl+C in both terminals

# 2. Delete old venv
cd C:\Projects\DOWNVID\backend
Remove-Item -Recurse -Force venv

# 3. Run setup
cd C:\Projects\DOWNVID
.\setup-backend.bat

# 4. Start backend
cd backend
.\venv\Scripts\Activate.ps1
python main.py

# 5. In another terminal, start frontend
cd C:\Projects\DOWNVID\frontend
npm run dev
```

---

## ✅ Success Indicators

1. Backend shows: `Uvicorn running on http://0.0.0.0:8000`
2. Frontend footer shows: `🟢 WebSocket Connected`
3. No red errors in browser console
4. Download progress bar appears when clicking Download

---

After following these steps, the WebSocket will work! 🎉
