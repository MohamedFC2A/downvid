'use client';

import { useSettings } from '@/hooks/useSettings';

export function SettingsSync() {
    useSettings();
    return null;
}