export type ThemeMode = 'midnight' | 'neon' | 'light';
export type UpscaleModel = 'real-esrgan' | 'video-enhance';
export type AppLanguage = 'ar' | 'en';

export type AppSettings = {
    theme: ThemeMode;
    language: AppLanguage;
    reducedMotion: boolean;
    dataSaver: boolean;
    autoPaste: boolean;
    aiInsightsEnabled: boolean;
    aiFixEnabled: boolean;
    upscaleEnabled: boolean;
    defaultUpscaleModel: UpscaleModel;
};

export const SETTINGS_KEY = 'downvid:settings:v1';

export const defaultSettings: AppSettings = {
    theme: 'midnight',
    language: 'en',
    reducedMotion: false,
    dataSaver: false,
    autoPaste: true,
    aiInsightsEnabled: true,
    aiFixEnabled: true,
    upscaleEnabled: true,
    defaultUpscaleModel: 'video-enhance',
};

export function loadSettings(): AppSettings {
    if (typeof window === 'undefined') return defaultSettings;
    try {
        const raw = window.localStorage.getItem(SETTINGS_KEY);
        if (!raw) {
            const prefersLight = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: light)').matches;
            const prefersReducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const navLang = (navigator.language || 'en').toLowerCase();
            const language: AppLanguage = navLang.startsWith('ar') ? 'ar' : 'en';

            const connection = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
            const saveData = Boolean(connection?.saveData);
            const effective = (connection?.effectiveType || '').toLowerCase();
            const slow = effective === '2g' || effective === 'slow-2g';

            return {
                ...defaultSettings,
                theme: prefersLight ? 'light' : 'midnight',
                reducedMotion: prefersReducedMotion,
                dataSaver: saveData || slow,
                language,
            };
        }
        const parsed = JSON.parse(raw);
        return {
            ...defaultSettings,
            ...parsed,
        } as AppSettings;
    } catch {
        return defaultSettings;
    }
}

export function saveSettings(settings: AppSettings) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function applySettings(settings: AppSettings) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.dataset.reducedMotion = settings.reducedMotion ? 'true' : 'false';
    root.dataset.dataSaver = settings.dataSaver ? 'true' : 'false';
    root.lang = settings.language;
    root.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
}
