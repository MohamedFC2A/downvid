'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlements } from '@/hooks/useEntitlements';
import { Logo } from '@/components/Logo';
import type { AppLanguage, ThemeMode } from '@/lib/settings';
import { t } from '@/lib/i18n';

const themeOptions: Array<{ id: ThemeMode; titleKey: string; descKey: string }> = [
    { id: 'midnight', titleKey: 'settings.theme.darkTitle', descKey: 'settings.theme.darkDesc' },
    { id: 'light', titleKey: 'settings.theme.lightTitle', descKey: 'settings.theme.lightDesc' },
];

const languageOptions: Array<{ id: AppLanguage; titleKey: string; descKey: string }> = [
    { id: 'ar', titleKey: 'settings.language.arTitle', descKey: 'settings.language.arDesc' },
    { id: 'en', titleKey: 'settings.language.enTitle', descKey: 'settings.language.enDesc' },
];

export function SettingsPage() {
    const { settings, updateSettings, ready } = useSettings();
    const auth = useAuth();
    const entitlements = useEntitlements();
    const lang = settings.language;
    const rtl = lang === 'ar';
    const motionDuration = settings.reducedMotion ? 0 : 0.5;
    const motionDelay = settings.reducedMotion ? 0 : 0.1;
    const aiLocked = auth.configured && !entitlements.aiEnabled;

    return (
        <main className="min-h-screen pt-28 pb-20 px-6 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-[linear-gradient(115deg,_rgba(255,255,255,0.04)_0%,_transparent_55%)]" />
            </div>

            <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10">
                <header className="flex flex-col gap-4">
                    <Logo />
                    <div className="space-y-2">
                        <p className={`text-xs font-mono text-[var(--foreground)] opacity-60 ${lang === "ar" ? "" : "uppercase tracking-[0.35em]"}`}>{t(lang, 'settings.kicker')}</p>
                        <h1 className="text-3xl md:text-4xl font-semibold text-[var(--foreground)]">{t(lang, 'settings.title')}</h1>
                        <p className="text-[var(--foreground)] opacity-60 max-w-2xl">
                            {t(lang, 'settings.subtitle')}
                        </p>
                    </div>
                </header>

                <div className="grid gap-6 lg:grid-cols-3">
                    <motion.section
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: motionDuration }}
                        className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] backdrop-blur-xl p-6 shadow-[var(--glass-shadow)]"
                    >
                        <div className="mb-6">
                            <div className={`text-xs font-mono text-[var(--foreground)] opacity-60 ${lang === "ar" ? "" : "uppercase tracking-[0.3em]"}`}>{t(lang, 'settings.appearance')}</div>
                            <h2 className="text-lg font-semibold text-[var(--foreground)] mt-2">{t(lang, 'settings.themeTitle')}</h2>
                        </div>
                        <div className="space-y-4">
                            {themeOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    disabled={!ready}
                                    onClick={() => updateSettings({ theme: option.id })}
                                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                                        settings.theme === option.id
                                            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                                            : 'border-[var(--panel-border)] bg-[var(--deep)] hover:opacity-90'
                                    }`}
                                >
                                    <div className="text-sm font-semibold text-[var(--foreground)]">{t(lang, option.titleKey)}</div>
                                    <div className="text-xs text-[var(--foreground)] opacity-60 mt-1">{t(lang, option.descKey)}</div>
                                </button>
                            ))}
                        </div>
                        <div className="mt-6 border-t border-[var(--panel-border)] pt-6 space-y-6">
                            <div>
                                <div className={`text-xs font-mono text-[var(--foreground)] opacity-60 ${lang === "ar" ? "" : "uppercase tracking-[0.3em]"}`}>{t(lang, 'settings.languageKicker')}</div>
                                <h2 className="text-lg font-semibold text-[var(--foreground)] mt-2">{t(lang, 'settings.languageTitle')}</h2>
                            </div>
                            <LanguageSwitch
                                value={settings.language}
                                onChange={(v) => updateSettings({ language: v })}
                                disabled={!ready}
                            />
                            <div className="space-y-4">
                                {languageOptions.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        disabled={!ready}
                                        onClick={() => updateSettings({ language: option.id })}
                                        className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                                            settings.language === option.id
                                                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                                                : 'border-[var(--panel-border)] bg-[var(--deep)] hover:opacity-90'
                                        }`}
                                    >
                                        <div className="text-sm font-semibold text-[var(--foreground)]">{t(lang, option.titleKey)}</div>
                                        <div className="text-xs text-[var(--foreground)] opacity-60 mt-1">{t(lang, option.descKey)}</div>
                                    </button>
                                ))}
                            </div>

                            <ToggleRow
                                label={t(lang, 'settings.reducedMotion')}
                                description={t(lang, 'settings.reducedMotionDesc')}
                                enabled={settings.reducedMotion}
                                onToggle={() => updateSettings({ reducedMotion: !settings.reducedMotion })}
                                disabled={!ready}
                                rtl={rtl}
                            />
                        </div>
                    </motion.section>

                    <motion.section
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: motionDuration, delay: motionDelay }}
                        className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] backdrop-blur-xl p-6 shadow-[var(--glass-shadow)]"
                    >
                        <div className="mb-6">
                            <div className={`text-xs font-mono text-[var(--foreground)] opacity-60 ${lang === "ar" ? "" : "uppercase tracking-[0.3em]"}`}>{t(lang, 'settings.network')}</div>
                            <h2 className="text-lg font-semibold text-[var(--foreground)] mt-2">{t(lang, 'settings.bandwidth')}</h2>
                        </div>
                        <div className="space-y-6">
                            <ToggleRow
                                label={t(lang, 'settings.dataSaver')}
                                description={t(lang, 'settings.dataSaverDesc')}
                                enabled={settings.dataSaver}
                                onToggle={() => updateSettings({ dataSaver: !settings.dataSaver })}
                                disabled={!ready}
                                rtl={rtl}
                            />
                            <ToggleRow
                                label={t(lang, 'settings.autoPaste')}
                                description={t(lang, 'settings.autoPasteDesc')}
                                enabled={settings.autoPaste}
                                onToggle={() => updateSettings({ autoPaste: !settings.autoPaste })}
                                disabled={!ready}
                                rtl={rtl}
                            />
                        </div>
                    </motion.section>

                    <motion.section
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: motionDuration, delay: motionDelay * 2 }}
                        className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] backdrop-blur-xl p-6 shadow-[var(--glass-shadow)]"
                    >
                        <div className="mb-6">
                            <div className={`text-xs font-mono text-[var(--foreground)] opacity-60 ${lang === "ar" ? "" : "uppercase tracking-[0.3em]"}`}>{t(lang, 'settings.ai')}</div>
                            <h2 className="text-lg font-semibold text-[var(--foreground)] mt-2">{t(lang, 'settings.ai')}</h2>
                        </div>
                        {aiLocked && (
                            <div className="mb-5 rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-4 text-xs text-[var(--foreground)] opacity-75">
                                {auth.user ? (
                                    <>
                                        {t(lang, 'subs.aiLocked')}
                                        {' '}
                                        <Link className="underline underline-offset-4" href="/subscriptions">
                                            {t(lang, 'subs.upgradeCta')}
                                        </Link>
                                    </>
                                ) : (
                                    <>
                                        <Link className="underline underline-offset-4" href="/auth">
                                            {t(lang, 'subs.loginToUse')}
                                        </Link>
                                        {' '}
                                        <Link className="underline underline-offset-4" href="/subscriptions">
                                            {t(lang, 'subs.seePlans')}
                                        </Link>
                                    </>
                                )}
                            </div>
                        )}
                        <div className="space-y-6 mb-6">
                            <ToggleRow
                                label={t(lang, "settings.aiInsights")}
                                description={t(lang, "settings.aiInsightsDesc")}
                                enabled={settings.aiInsightsEnabled && !aiLocked}
                                onToggle={() => updateSettings({ aiInsightsEnabled: !settings.aiInsightsEnabled })}
                                disabled={!ready || aiLocked}
                                rtl={rtl}
                            />
                            <ToggleRow
                                label={t(lang, "settings.aiFix")}
                                description={t(lang, "settings.aiFixDesc")}
                                enabled={settings.aiFixEnabled && !aiLocked}
                                onToggle={() => updateSettings({ aiFixEnabled: !settings.aiFixEnabled })}
                                disabled={!ready || aiLocked}
                                rtl={rtl}
                            />
                            <ToggleRow
                                label={t(lang, "settings.aiUpscale")}
                                description={t(lang, "settings.aiUpscaleDesc")}
                                enabled={settings.upscaleEnabled && !aiLocked}
                                onToggle={() => updateSettings({ upscaleEnabled: !settings.upscaleEnabled })}
                                disabled={!ready || aiLocked}
                                rtl={rtl}
                            />
                        </div>
                    </motion.section>
                </div>
            </div>
        </main>
    );
}

function ToggleRow({
    label,
    description,
    enabled,
    onToggle,
    disabled,
    rtl,
}: {
    label: string;
    description: string;
    enabled: boolean;
    onToggle: () => void;
    disabled?: boolean;
    rtl?: boolean;
}) {
    return (
        <div className={`flex items-center justify-between gap-4 ${rtl ? 'flex-row-reverse' : ''}`}>
            <div className={rtl ? 'text-right' : ''}>
                <div className="text-sm font-semibold text-[var(--foreground)]">{label}</div>
                <div className="text-xs text-[var(--foreground)] opacity-60 mt-1">{description}</div>
            </div>
            <button
                type="button"
                disabled={disabled}
                onClick={onToggle}
                className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-all ${
                    enabled
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                        : 'border-[var(--panel-border)] bg-[var(--deep)]'
                }`}
            >
                <span
                    className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-[var(--foreground)] shadow transition-all ${
                        enabled ? (rtl ? 'translate-x-1' : 'translate-x-5') : (rtl ? 'translate-x-5' : 'translate-x-1')
                    }`}
                />
            </button>
        </div>
    );
}

function LanguageSwitch({
    value,
    onChange,
    disabled,
}: {
    value: AppLanguage;
    onChange: (v: AppLanguage) => void;
    disabled?: boolean;
}) {
    const isAr = value === 'ar';
    return (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--deep)] p-3">
            <div className="relative h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-1">
                <div
                    className="absolute top-1 bottom-1 w-1/2 rounded-lg border border-[var(--panel-border)] bg-[var(--accent-soft)] transition-transform"
                    style={{ transform: isAr ? 'translateX(100%)' : 'translateX(0%)' }}
                />
                <div className="relative z-10 grid h-full grid-cols-2">
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange('en')}
                        className={`rounded-lg text-sm font-semibold transition-opacity ${!isAr ? 'opacity-100' : 'opacity-65 hover:opacity-90'}`}
                    >
                        EN
                    </button>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange('ar')}
                        className={`rounded-lg text-sm font-semibold transition-opacity ${isAr ? 'opacity-100' : 'opacity-65 hover:opacity-90'}`}
                    >
                        AR
                    </button>
                </div>
            </div>
        </div>
    );
}
