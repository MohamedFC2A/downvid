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

deepseek_service = DeepSeekService()
