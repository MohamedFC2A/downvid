'use client';

import { motion } from 'framer-motion';
import { useSettings } from '@/hooks/useSettings';
import { Logo } from '@/components/Logo';
import type { ThemeMode, UpscaleModel } from '@/lib/settings';

const themeOptions: Array<{ id: ThemeMode; title: string; desc: string }> = [
    { id: 'midnight', title: 'Midnight Black', desc: 'OLED blacks with low-glare depth.' },
    { id: 'neon', title: 'Neon Cyberpunk', desc: 'Electric accents, high-contrast glow.' },
    { id: 'light', title: 'Clean Light', desc: 'Bright workspace with crisp contrast.' },
];

const modelOptions: Array<{ id: UpscaleModel; title: string; desc: string }> = [
    { id: 'real-esrgan', title: 'Real-ESRGAN', desc: 'Sharpness boost for crisp edges.' },
    { id: 'video-enhance', title: 'Video-Enhance', desc: 'Smoothness-first cinematic polish.' },
];

export function SettingsPage() {
    const { settings, updateSettings, ready } = useSettings();
    const motionDuration = settings.reducedMotion ? 0 : 0.5;
    const motionDelay = settings.reducedMotion ? 0 : 0.1;

    return (
        <main className="min-h-screen pt-28 pb-20 px-6 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(56,189,248,0.2),_transparent_70%)] blur-3xl" />
                <div className="absolute bottom-[-200px] right-[-120px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,_rgba(16,185,129,0.16),_transparent_70%)] blur-3xl" />
                <div className="absolute inset-0 bg-[linear-gradient(115deg,_rgba(255,255,255,0.04)_0%,_transparent_55%)]" />
            </div>

            <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10">
                <header className="flex flex-col gap-4">
                    <Logo />
                    <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70 font-mono">Command Center</p>
                        <h1 className="text-3xl md:text-4xl font-semibold text-zinc-100">Enterprise Settings</h1>
                        <p className="text-zinc-400 max-w-2xl">
                            Persistent performance controls for appearance, network behavior, and AI upscaling.
                        </p>
                    </div>
                </header>

                <div className="grid gap-6 lg:grid-cols-3">
                    <motion.section
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: motionDuration }}
                        className="rounded-3xl border border-cyan-400/20 bg-black/40 backdrop-blur-xl p-6 shadow-[0_25px_80px_rgba(0,0,0,0.4)]"
                    >
                        <div className="mb-6">
                            <div className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Appearance</div>
                            <h2 className="text-lg font-semibold text-zinc-100 mt-2">Theme Engine</h2>
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
                                            ? 'border-cyan-300/60 bg-cyan-400/10 shadow-[0_0_25px_rgba(56,189,248,0.2)]'
                                            : 'border-white/10 bg-white/5 hover:border-cyan-200/40'
                                    }`}
                                >
                                    <div className="text-sm font-semibold text-zinc-100">{option.title}</div>
                                    <div className="text-xs text-zinc-400 mt-1">{option.desc}</div>
                                </button>
                            ))}
                        </div>
                        <div className="mt-6 border-t border-white/10 pt-6">
                            <ToggleRow
                                label="Reduced Motion"
                                description="Minimize motion for accessibility."
                                enabled={settings.reducedMotion}
                                onToggle={() => updateSettings({ reducedMotion: !settings.reducedMotion })}
                                disabled={!ready}
                            />
                        </div>
                    </motion.section>

                    <motion.section
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: motionDuration, delay: motionDelay }}
                        className="rounded-3xl border border-emerald-300/20 bg-black/40 backdrop-blur-xl p-6 shadow-[0_25px_80px_rgba(0,0,0,0.4)]"
                    >
                        <div className="mb-6">
                            <div className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Network</div>
                            <h2 className="text-lg font-semibold text-zinc-100 mt-2">Bandwidth Discipline</h2>
                        </div>
                        <div className="space-y-6">
                            <ToggleRow
                                label="Data Saver"
                                description="Hide thumbnails and heavy previews."
                                enabled={settings.dataSaver}
                                onToggle={() => updateSettings({ dataSaver: !settings.dataSaver })}
                                disabled={!ready}
                            />
                            <ToggleRow
                                label="Auto-Paste"
                                description="Scan clipboard on focus for links."
                                enabled={settings.autoPaste}
                                onToggle={() => updateSettings({ autoPaste: !settings.autoPaste })}
                                disabled={!ready}
                            />
                        </div>
                    </motion.section>

                    <motion.section
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: motionDuration, delay: motionDelay * 2 }}
                        className="rounded-3xl border border-amber-300/20 bg-black/40 backdrop-blur-xl p-6 shadow-[0_25px_80px_rgba(0,0,0,0.4)]"
                    >
                        <div className="mb-6">
                            <div className="text-xs uppercase tracking-[0.3em] text-amber-200/70">AI Preferences</div>
                            <h2 className="text-lg font-semibold text-zinc-100 mt-2">Default Upscale Model</h2>
                        </div>
                        <div className="space-y-4">
                            {modelOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    disabled={!ready}
                                    onClick={() => updateSettings({ defaultUpscaleModel: option.id })}
                                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                                        settings.defaultUpscaleModel === option.id
                                            ? 'border-amber-300/60 bg-amber-300/10 shadow-[0_0_25px_rgba(251,191,36,0.25)]'
                                            : 'border-white/10 bg-white/5 hover:border-amber-200/40'
                                    }`}
                                >
                                    <div className="text-sm font-semibold text-zinc-100">{option.title}</div>
                                    <div className="text-xs text-zinc-400 mt-1">{option.desc}</div>
                                </button>
                            ))}
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
}: {
    label: string;
    description: string;
    enabled: boolean;
    onToggle: () => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div>
                <div className="text-sm font-semibold text-zinc-100">{label}</div>
                <div className="text-xs text-zinc-500 mt-1">{description}</div>
            </div>
            <button
                type="button"
                disabled={disabled}
                onClick={onToggle}
                className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-all ${
                    enabled
                        ? 'border-cyan-300/60 bg-cyan-400/30'
                        : 'border-white/10 bg-white/5'
                }`}
            >
                <span
                    className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow transition-all ${
                        enabled ? 'translate-x-5 shadow-[0_0_12px_rgba(56,189,248,0.5)]' : 'translate-x-1'
                    }`}
                />
            </button>
        </div>
    );
}
