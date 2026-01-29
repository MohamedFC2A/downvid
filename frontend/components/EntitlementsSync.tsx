'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlements } from '@/hooks/useEntitlements';

export function EntitlementsSync() {
    const auth = useAuth();
    const entitlements = useEntitlements();

    useEffect(() => {
        if (!auth.configured) return;
        void entitlements.refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.configured, auth.accessToken]);

    return null;
}
