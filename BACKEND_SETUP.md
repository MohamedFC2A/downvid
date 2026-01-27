# Backend Setup - تثبيت المكتبات

## المشكلة
عند تشغيل Backend ظهرت رسالة: `ModuleNotFoundError: No module named 'yt_dlp'`

## الحل

### الطريقة الصحيحة (PowerShell):

```powershell
# 1. اذهب لمجلد backend
cd C:\Projects\DOWNVID\backend

# 2. أنشئ virtual environment
python -m venv venv

# 3. فعّل الـ virtual environment
.\venv\Scripts\Activate.ps1

# إذا ظهرت رسالة خطأ عن execution policy، شغل هذا الأمر أولاً:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 4. ثبت المكتبات
pip install -r requirements.txt

# 5. انسخ ملف .env
copy .env.example .env

# 6. افتح .env وضع DeepSeek API key
# notepad .env
# ضع: DEEPSEEK_API_KEY=sk-your-key-here

# 7. شغل Backend
python main.py
```

### التحقق من نجاح التثبيت:

```powershell
pip list
```

يجب أن ترى:
- fastapi
- uvicorn
- yt-dlp
- httpx
- pydantic
- python-dotenv

---

## تشغيل سريع بعد التثبيت:

```powershell
cd C:\Projects\DOWNVID\backend
.\venv\Scripts\Activate.ps1
python main.py
```

يجب أن ترى:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## ملاحظات مهمة:

1. **لا تستخدم `&&` في PowerShell** - استخدم `;` بدلاً منها أو شغل الأوامر بشكل منفصل
2. **تأكد أن الـ virtual environment مفعل** - يجب أن ترى `(venv)` في بداية السطر
3. **DeepSeek API key ضروري** للحصول على AI Insights
4. **البورت 8000 يجب أن يكون فاضي** - إذا كان مستخدم، أغلق التطبيق القديم

---

## Quick Test بعد التشغيل:

افتح متصفح وادخل:
```
http://localhost:8000
```

يجب أن تشوف:
```json
{"message": "GlassLoad AI API - Ready to serve"}
```

✅ إذا شفت هذه الرسالة، Backend شغال بنجاح!
