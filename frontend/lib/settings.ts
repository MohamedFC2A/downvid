export type ThemeMode = 'midnight' | 'neon' | 'light';
export type UpscaleModel = 'real-esrgan' | 'video-enhance';

export type AppSettings = {
    theme: ThemeMode;
    reducedMotion: boolean;
    dataSaver: boolean;
    autoPaste: boolean;
    defaultUpscaleModel: UpscaleModel;
};

export const SETTINGS_KEY = 'downvid:settings:v1';

export const defaultSettings: AppSettings = {
    theme: 'midnight',
    reducedMotion: false,
    dataSaver: false,
    autoPaste: true,
    defaultUpscaleModel: 'real-esrgan',
};

export function loadSettings(): AppSettings {
    if (typeof window === 'undefined') return defaultSettings;
    try {
        const raw = window.localStorage.getItem(SETTINGS_KEY);
        if (!raw) return defaultSettings;
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
}