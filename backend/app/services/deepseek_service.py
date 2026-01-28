import httpx
import json
from app.core.config import settings

class DeepSeekService:
    async def analyze_metadata(self, title: str, description: str):
        prompt = f"""
        Analyze this video metadata.
        Title: {title}
        Description: {description}
        
        Output a strict JSON with:
        - 'summary': (2 bullet points in Arabic)
        - 'sentiment': (one word)
        - 'hashtags': (5 tags)
        """
        
        if not settings.DEEPSEEK_API_KEY:
            # Fallback mock for development
            return {
                "summary": ["تحليل تجريبي للفيديو المختار", "المحتوى يبدو تقنياً ومفيداً للمستخدم"],
                "sentiment": "Neutral",
                "hashtags": ["#demo", "#test", "#video", "#analysis", "#api"]
            }

        headers = {
            "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant that outputs JSON only."},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"}
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://api.deepseek.com/chat/completions", # Hardcoded for now to ensure standard URL
                    json=payload, 
                    headers=headers, 
                    timeout=30.0
                )
                response.raise_for_status()
                result = response.json()
                content = result['choices'][0]['message']['content']
                return json.loads(content)
            except Exception as e:
                print(f"DeepSeek Error: {e}")
                return {
                    "summary": ["خطأ في الاتصال بخدمة الذكاء الاصطناعي", "يرجى التحقق من مفتاح API"],
                    "sentiment": "Error",
                    "hashtags": ["#error", "#api", "#fail"]
                }

    async def diagnose_error(self, *, stage: str, url: str, error: str, context: dict):
        prompt = f"""
        أنت مصحح أخطاء خبير في منصات تحميل الفيديو (yt-dlp / YouTube / WebSocket / FastAPI / Next.js).
        المطلوب: تشخيص السبب الجذري واقتراح خطوات عملية لإصلاح المشكلة بسرعة.

        أعطِ JSON فقط بهذه المفاتيح:
        - root_cause: نص عربي قصير يشرح السبب المرجح
        - confidence: رقم من 0 إلى 1
        - quick_fixes: قائمة نصوص (3-8) خطوات سريعة
        - deep_fixes: قائمة نصوص (2-6) حلول أعمق/دائمة
        - need_cookies: true/false
        - need_update: true/false
        - notes: ملاحظات إضافية قصيرة

        السياق:
        stage: {stage}
        url: {url}
        error: {error}
        context: {json.dumps(context, ensure_ascii=False)}
        """

        if not settings.DEEPSEEK_API_KEY:
            return {
                "root_cause": "مفتاح DeepSeek غير مهيأ، لذلك لا يمكن تشغيل المصحح الذكي.",
                "confidence": 0.2,
                "quick_fixes": [
                    "تأكد من ضبط DEEPSEEK_API_KEY في متغيرات البيئة",
                    "حدّث yt-dlp لأحدث إصدار",
                    "جرّب تشغيل Deno/Node كـ JS runtime للـ yt-dlp",
                ],
                "deep_fixes": [
                    "استخدم cookies للـ YouTube عند مشاكل القيود/consent",
                    "سجّل الـ logs وشاركها في GitHub issue إن استمرت المشكلة",
                ],
                "need_cookies": False,
                "need_update": True,
                "notes": "Fallback بدون AI",
            }

        headers = {
            "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": "You are a strict JSON generator. Output JSON only."},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://api.deepseek.com/chat/completions",
                    json=payload,
                    headers=headers,
                    timeout=30.0,
                )
                response.raise_for_status()
                result = response.json()
                content = result["choices"][0]["message"]["content"]
                return json.loads(content)
            except Exception as e:
                return {
                    "root_cause": "فشل الاتصال بخدمة DeepSeek.",
                    "confidence": 0.3,
                    "quick_fixes": ["تحقق من DEEPSEEK_API_KEY", "أعد المحاولة لاحقاً"],
                    "deep_fixes": ["تأكد من اتصال الشبكة داخل السيرفر"],
                    "need_cookies": False,
                    "need_update": False,
                    "notes": f"DeepSeek Error: {e}",
                }

deepseek_service = DeepSeekService()
