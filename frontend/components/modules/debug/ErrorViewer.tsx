'use client';

import { useMemo, useState } from 'react';
import { TerminalBlock } from '@/components/ui/TerminalBlock';
import { Button } from '@/components/ui/Button';
import { t } from '@/lib/i18n';
import { useSettings } from '@/hooks/useSettings';

export type DebugLogItem = {
    ts: string;
    level: 'info' | 'warn' | 'error';
    title: string;
    detail?: string;
    data?: Record<string, unknown>;
};

function safeJson(v: unknown) {
    try {
        return JSON.stringify(v, null, 2);
    } catch {
        return String(v);
    }
}

export function ErrorViewer({
    items,
    onClear,
}: {
    items: DebugLogItem[];
    onClear: () => void;
}) {
    const { settings } = useSettings();
    const lang = settings.language;
    const [copied, setCopied] = useState(false);

    const visible = useMemo(() => items.slice(0, 80), [items]);

    const exportText = useMemo(() => {
        const payload = visible.map((it) => ({
            ts: it.ts,
            level: it.level,
            title: it.title,
            detail: it.detail,
            data: it.data,
        }));
        return safeJson(payload);
    }, [visible]);

    async function copyAll() {
        try {
            await navigator.clipboard.writeText(exportText);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
        } catch {
            // ignore
        }
    }

    return (
        <TerminalBlock title={t(lang, 'debug.title')} className="min-h-[260px]">
            <div className="flex items-center justify-between gap-3 mb-3">
                <div className="text-[10px] text-[var(--foreground)] opacity-60 font-mono">
                    {t(lang, 'debug.hint')}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" className="h-8 px-3 text-xs" onClick={copyAll}>
                        {copied ? t(lang, 'debug.copied') : t(lang, 'debug.copy')}
                    </Button>
                    <Button variant="secondary" className="h-8 px-3 text-xs" onClick={onClear}>
                        {t(lang, 'debug.clear')}
                    </Button>
                </div>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {visible.length === 0 ? (
                    <div className="text-[var(--foreground)] opacity-60 text-xs font-mono">{t(lang, 'debug.empty')}</div>
                ) : (
                    visible.map((it, idx) => (
                        <details
                            key={`${it.ts}-${idx}`}
                            className={`rounded border border-[var(--panel-border)] bg-[var(--panel)] ${
                                it.level === 'error' ? 'ring-1 ring-red-500/25' : it.level === 'warn' ? 'ring-1 ring-amber-500/20' : ''
                            }`}
                            open={idx < 2}
                        >
                            <summary className="cursor-pointer select-none px-3 py-2 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`text-[10px] font-mono ${
                                            it.level === 'error'
                                                ? 'text-red-600'
                                                : it.level === 'warn'
                                                    ? 'text-amber-600'
                                                    : 'text-[var(--foreground)] opacity-75'
                                        }`}
                                    >
                                        {it.level.toUpperCase()}
                                    </span>
                                    <span className="text-[var(--foreground)] opacity-85 font-mono text-[10px]">{it.title}</span>
                                </div>
                                <span className="text-[var(--foreground)] opacity-55 font-mono text-[10px]">{new Date(it.ts).toLocaleTimeString()}</span>
                            </summary>
                            {it.detail ? (
                                <pre className="px-3 pb-3 text-[11px] text-[var(--foreground)] opacity-85 whitespace-pre-wrap break-words">
                                    {it.detail}
                                </pre>
                            ) : null}
                            {it.data ? (
                                <pre className="px-3 pb-3 text-[11px] text-[var(--foreground)] opacity-75 whitespace-pre-wrap break-words">
                                    {safeJson(it.data)}
                                </pre>
                            ) : null}
                        </details>
                    ))
                )}
            </div>
        </TerminalBlock>
    );
}

