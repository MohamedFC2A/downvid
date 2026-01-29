export type AppLanguage = "ar" | "en";

type Dict = Record<string, string>;

const EN: Dict = {
    "nav.tool": "Tool",
    "nav.settings": "Settings",
    "nav.docs": "Docs",
    "nav.login": "Login",

    "tool.tagline": "Downvid Control Room",
    "tool.urlPlaceholder": "Paste a URL (YouTube, TikTok, Instagram...)",
    "tool.analyze": "Analyze",
    "tool.analyzing": "Analyzing...",
    "tool.showLogs": "Show Logs",
    "tool.hideLogs": "Hide Logs",
    "tool.verified": "Verified",
    "tool.quality": "Quality",
    "tool.wsConnected": "connected",
    "tool.wsReconnecting": "reconnecting…",
    "tool.downloadBest": "Download Best",
    "tool.downloadSelected": "Download Selected",
    "tool.ready": "Ready",
    "tool.downloadReady": "Download is ready",
    "tool.downloadFile": "Download File",
    "tool.token": "Token",

    "quality.video": "Video",
    "quality.audio": "Audio",
    "quality.none": "No {mode} formats detected for this link.",

    "upscale.title": "AI 4K Upscale",
    "upscale.model": "Model",
    "upscale.unlockHint": "Download a video first to unlock upscaling.",
    "upscale.cta": "✨ AI 4K Upscale",
    "upscale.download4k": "Download 4K",

    "ai.title": "DEEPSEEK INTELLIGENCE",
    "ai.summarize": "Summarize Video",
    "ai.summarizing": "Summarizing...",
    "ai.summary": "Summary",
    "ai.keyMoments": "Key Moments",
    "ai.takeaways": "Takeaways",
    "ai.hashtags": "Hashtags",
    "ai.copyHashtags": "Copy Hashtags",
    "ai.copied": "Copied",
    "ai.sourceTranscript": "Transcript",
    "ai.sourceMetadata": "Metadata",
};

const AR: Dict = {
    "nav.tool": "الأداة",
    "nav.settings": "الإعدادات",
    "nav.docs": "الوثائق",
    "nav.login": "تسجيل الدخول",

    "tool.tagline": "غرفة التحكم",
    "tool.urlPlaceholder": "الصق الرابط (يوتيوب، تيك توك، انستغرام...)",
    "tool.analyze": "تحليل",
    "tool.analyzing": "جارٍ التحليل...",
    "tool.showLogs": "إظهار السجل",
    "tool.hideLogs": "إخفاء السجل",
    "tool.verified": "موثوق",
    "tool.quality": "الجودة",
    "tool.wsConnected": "متصل",
    "tool.wsReconnecting": "يعيد الاتصال…",
    "tool.downloadBest": "تحميل الأفضل",
    "tool.downloadSelected": "تحميل المحدد",
    "tool.ready": "جاهز",
    "tool.downloadReady": "التحميل جاهز",
    "tool.downloadFile": "تحميل الملف",
    "tool.token": "رمز",

    "quality.video": "فيديو",
    "quality.audio": "صوت",
    "quality.none": "لا توجد صيغ {mode} لهذا الرابط.",

    "upscale.title": "ترقية 4K بالذكاء الاصطناعي",
    "upscale.model": "النموذج",
    "upscale.unlockHint": "قم بتحميل الفيديو أولاً لتفعيل الترقية.",
    "upscale.cta": "✨ ترقية 4K",
    "upscale.download4k": "تحميل 4K",

    "ai.title": "ذكاء DeepSeek",
    "ai.summarize": "تلخيص المقطع",
    "ai.summarizing": "جارٍ التلخيص...",
    "ai.summary": "الملخص",
    "ai.keyMoments": "أهم النقاط",
    "ai.takeaways": "الخلاصة",
    "ai.hashtags": "هاشتاقات",
    "ai.copyHashtags": "نسخ الهاشتاقات",
    "ai.copied": "تم النسخ",
    "ai.sourceTranscript": "من النص",
    "ai.sourceMetadata": "من البيانات",
};

const DICTS: Record<AppLanguage, Dict> = { en: EN, ar: AR };

export function getDirection(lang: AppLanguage): "rtl" | "ltr" {
    return lang === "ar" ? "rtl" : "ltr";
}

export function t(lang: AppLanguage, key: string, vars?: Record<string, string | number>): string {
    const dict = DICTS[lang] || EN;
    const fallback = EN[key] || key;
    const template = dict[key] || fallback;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, name) => {
        const v = vars[name];
        return v === undefined || v === null ? `{${name}}` : String(v);
    });
}
