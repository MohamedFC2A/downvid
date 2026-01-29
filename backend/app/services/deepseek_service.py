import httpx
import json
from app.core.config import settings
from typing import Any, Optional

class DeepSeekService:
    async def _call_json(self, *, system: str, user: str, timeout: float = 45.0) -> dict[str, Any]:
        if not settings.DEEPSEEK_API_KEY:
            raise RuntimeError("DEEPSEEK_API_KEY is not configured")

        headers = {
            "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.deepseek.com/chat/completions",
                json=payload,
                headers=headers,
                timeout=timeout,
            )
            response.raise_for_status()
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            return json.loads(content)

    async def analyze_metadata(self, title: str, description: str, *, lang: str = "ar"):
        lang_norm = (lang or "ar").strip().lower()
        is_ar = lang_norm.startswith("ar")
        summary_lang = "Arabic" if is_ar else "English"
        prompt = f"""
Analyze this video.

Title: {title}
Description: {description}

Return STRICT JSON with keys:
- summary: array of 3-6 bullets in {summary_lang}
- sentiment: one word (Positive/Neutral/Negative)
- topics: array of 5-10 short topics
- keywords: array of 10-20 keywords (single words or short phrases)
- hashtags: array of 15-25 hashtags (high-signal, platform-friendly, "trend-like" style; no spaces; include #)
- hook: 1 short catchy line in {summary_lang}
- safety_notes: array (empty or short warnings like "no transcript, metadata-only")
"""
        
        if not settings.DEEPSEEK_API_KEY:
            # Fallback mock for development
            if is_ar:
                return {
                    "summary": ["تحليل تجريبي للفيديو المختار", "المحتوى يبدو تقنياً ومفيداً للمستخدم"],
                    "sentiment": "Neutral",
                    "topics": ["تقنية", "شرح", "أدوات", "فيديو"],
                    "keywords": ["فيديو", "تحميل", "جودة", "تحليل"],
                    "hashtags": ["#demo", "#test", "#video", "#analysis", "#api"],
                    "hook": "ملخص سريع ومفيد للمحتوى.",
                    "safety_notes": ["metadata-only"],
                }
            return {
                "summary": ["Demo analysis for the selected video", "Content looks technical and useful"],
                "sentiment": "Neutral",
                "topics": ["tech", "tutorial", "tools", "video"],
                "keywords": ["video", "download", "quality", "analysis"],
                "hashtags": ["#demo", "#test", "#video", "#analysis", "#api"],
                "hook": "Quick, useful breakdown in seconds.",
                "safety_notes": ["metadata-only"],
            }
        try:
            return await self._call_json(
                system="You are a strict JSON generator. Output JSON only.",
                user=prompt,
                timeout=45.0,
            )
        except Exception as e:
            if is_ar:
                return {
                    "summary": ["خطأ في الاتصال بخدمة الذكاء الاصطناعي", "يرجى التحقق من مفتاح API"],
                    "sentiment": "Error",
                    "topics": [],
                    "keywords": [],
                    "hashtags": ["#error", "#api", "#fail"],
                    "hook": "تعذر تشغيل الذكاء الاصطناعي حالياً.",
                    "safety_notes": [f"DeepSeek Error: {e}"],
                }
            return {
                "summary": ["AI service connection error", "Please verify the API key"],
                "sentiment": "Error",
                "topics": [],
                "keywords": [],
                "hashtags": ["#error", "#api", "#fail"],
                "hook": "AI is temporarily unavailable.",
                "safety_notes": [f"DeepSeek Error: {e}"],
            }

    async def summarize_video(
        self,
        *,
        title: str,
        description: str,
        transcript_text: Optional[str],
        lang: str = "ar",
    ) -> dict[str, Any]:
        lang_norm = (lang or "ar").strip().lower()
        is_ar = lang_norm.startswith("ar")
        out_lang = "Arabic" if is_ar else "English"

        transcript = (transcript_text or "").strip()
        if len(transcript) > 18000:
            transcript = transcript[:18000]

        prompt = f"""
Summarize this video for a user.

Title: {title}
Description: {description}
Transcript (may be partial): {transcript if transcript else "[NO TRANSCRIPT AVAILABLE]"}

Return STRICT JSON with keys:
- source: "transcript" | "metadata_fallback"
- summary: array of 6-12 bullets in {out_lang}
- key_moments: array of 5-10 short points (no timestamps required)
- takeaways: array of 3-6 actionable takeaways
- hashtags: array of 15-25 hashtags (high-signal, "trend-like" style; include #; no spaces)
- topics: array of 6-12 topics
- notes: short string (empty if none)
"""

        if not settings.DEEPSEEK_API_KEY:
            if is_ar:
                return {
                    "source": "metadata_fallback",
                    "summary": ["ميزة التلخيص تحتاج DEEPSEEK_API_KEY.", "يمكنك تفعيلها من إعدادات السيرفر."],
                    "key_moments": [],
                    "takeaways": [],
                    "hashtags": ["#downvid"],
                    "topics": [],
                    "notes": "Missing DEEPSEEK_API_KEY",
                }
            return {
                "source": "metadata_fallback",
                "summary": ["Summarization requires DEEPSEEK_API_KEY.", "Configure it on the server."],
                "key_moments": [],
                "takeaways": [],
                "hashtags": ["#downvid"],
                "topics": [],
                "notes": "Missing DEEPSEEK_API_KEY",
            }

        try:
            result = await self._call_json(
                system="You are a strict JSON generator. Output JSON only.",
                user=prompt,
                timeout=60.0,
            )
            if not transcript_text:
                # Ensure the source reflects reality
                result["source"] = "metadata_fallback"
            return result
        except Exception as e:
            if is_ar:
                return {
                    "source": "metadata_fallback",
                    "summary": ["فشل التلخيص حالياً.", "حاول مرة أخرى لاحقاً."],
                    "key_moments": [],
                    "takeaways": [],
                    "hashtags": ["#error", "#downvid"],
                    "topics": [],
                    "notes": f"DeepSeek Error: {e}",
                }
            return {
                "source": "metadata_fallback",
                "summary": ["Summarization failed right now.", "Please try again later."],
                "key_moments": [],
                "takeaways": [],
                "hashtags": ["#error", "#downvid"],
                "topics": [],
                "notes": f"DeepSeek Error: {e}",
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
