# 🚀 تشغيل GlassLoad AI v2.0 بشكل صحيح

## ✅ الطريقة الصحيحة (خطوة بخطوة)

### 1️⃣ Backend Terminal

**افتح PowerShell واكتب:**
```powershell
cd C:\Projects\DOWNVID\backend
.\venv\Scripts\Activate.ps1
pip install websockets redis
python main.py
```

**يجب أن ترى:**
```
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8000
```

✅ Backend جاهز!

---

### 2️⃣ Frontend Terminal  

**في terminal آخر:**
```powershell
cd C:\Projects\DOWNVID\frontend
npm run dev
```

**يجب أن ترى:**
```
▲ Next.js 15.1.5
- Local:        http://localhost:3000
```

✅ Frontend جاهز!

---

## 🌐 افتح المتصفح

اذهب إلى: **http://localhost:3000**

### ✅ علامات النجاح:

1. **في أسفل الصفحة:** 🟢 WebSocket Connected
2. **جرب الآن:**
   - الصق رابط يوتيوب (مثلاً: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
   - الحدود ستتحول للون الأحمر 🔴
   - اضغط "Analyze Video"
   - اختر Format & Quality
   - اضغط "Download MP4"
   - **سترى**: شريط التقدم يظهر في الأسفل مع السرعة والوقت المتبقي! 🎉

---

## 🐛 لو ظهرت مشاكل:

### ❌ "venv not found"
```powershell
cd C:\Projects\DOWNVID
.\setup-backend.bat
```

### ❌ "WebSocket connection error"
تأكد أن Backend شغال على port 8000

### ❌ "Module not found"
```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## 📝 ملاحظات مهمة:

1. **في PowerShell** استخدم `.\` قبل الملفات:
   - ✅ `.\restart-backend.bat`
   - ❌ `restart-backend.bat`

2. **Terminal منفصلة** للـ Backend والـ Frontend

3. **لا تغلق** الـ terminals وهما شغالين

---

## 🎯 Quick Start (One Command)

**أو استخدم:**
```powershell
cd C:\Projects\DOWNVID
.\start.bat
```

سيفتح terminal للـ Backend وآخر للـ Frontend تلقائياً!

---

**المشروع الآن جاهز للاستخدام!** 🚀
