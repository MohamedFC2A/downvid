'use client';

import { useCallback, useEffect, useState } from 'react';
import { applySettings, defaultSettings, loadSettings, saveSettings, type AppSettings } from '@/lib/settings';

export function useSettings() {
    const [settings, setSettings] = useState<AppSettings>(() => loadSettings() || defaultSettings);

    useEffect(() => {
        applySettings(settings);
    }, [settings]);

    const updateSettings = useCallback((patch: Partial<AppSettings>) => {
        setSettings((prev) => {
            const next = { ...prev, ...patch };
            saveSettings(next);
            applySettings(next);
            return next;
        });
    }, []);

    return {
        settings,
        updateSettings,
        ready: true,
    };
}
