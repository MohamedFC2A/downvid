'use client';

import { useCallback, useEffect, useState } from 'react';
import { applySettings, defaultSettings, loadSettings, saveSettings, type AppSettings } from '@/lib/settings';

export function useSettings() {
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const loaded = loadSettings();
        setSettings(loaded);
        applySettings(loaded);
        setReady(true);
    }, []);

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
        ready,
    };
}