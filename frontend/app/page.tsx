'use client';

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { useSettings } from "@/hooks/useSettings";
import { t } from "@/lib/i18n";

export default function Home() {
  const { settings } = useSettings();
  const lang = settings.language;
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[var(--background)]">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-10" />

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-20 pt-14 md:pt-20">
        <header className="flex items-center justify-between">
          <div className="scale-110 md:scale-125">
            <Logo />
          </div>
          <div className={`hidden items-center gap-6 text-xs font-mono text-[var(--foreground)] opacity-60 md:flex ${lang === "ar" ? "" : "uppercase tracking-[0.35em]"}`}>
            <span className="text-[var(--foreground)] opacity-80">DOWNVID</span>
            <span>{t(lang, "home.pipeline")}</span>
            <span>{t(lang, "home.secure")}</span>
          </div>
        </header>

        <div className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            <div className={`inline-flex items-center gap-2 rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-2 text-xs font-mono text-[var(--foreground)] opacity-70 ${lang === "ar" ? "" : "uppercase tracking-[0.3em]"}`}>
              {t(lang, "home.badge")}
            </div>
            <h1 className="font-display text-4xl leading-[1.05] text-[var(--foreground)] sm:text-5xl md:text-6xl">
              {t(lang, "home.headline1")}
              <span className="block text-[clamp(2.4rem,6vw,4.3rem)] text-[var(--foreground)] opacity-90">
                {t(lang, "home.headline2")}
              </span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-[var(--foreground)] opacity-70">
              {t(lang, "home.sub")}
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href="/tool">
                <Button className="h-14 px-10 text-base rounded-full">
                  {t(lang, "home.launch")}
                </Button>
              </Link>
              <Button variant="secondary" className="h-14 px-10 text-base rounded-full">
                {t(lang, "home.workflow")}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: t(lang, "home.card.qm.title"),
                desc: t(lang, "home.card.qm.desc"),
              },
              {
                title: t(lang, "home.card.rt.title"),
                desc: t(lang, "home.card.rt.desc"),
              },
              {
                title: t(lang, "home.card.sf.title"),
                desc: t(lang, "home.card.sf.desc"),
              },
              {
                title: t(lang, "home.card.sc.title"),
                desc: t(lang, "home.card.sc.desc"),
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 backdrop-blur-lg"
              >
                <div className={`text-xs font-mono text-[var(--foreground)] opacity-70 ${lang === "ar" ? "" : "uppercase tracking-[0.3em]"}`}>
                  {card.title}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)] opacity-70">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: t(lang, "home.stat.coverage.label"), value: t(lang, "home.stat.coverage.value") },
            { label: t(lang, "home.stat.adaptive.label"), value: t(lang, "home.stat.adaptive.value") },
            { label: t(lang, "home.stat.optimized.label"), value: t(lang, "home.stat.optimized.value") },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[var(--foreground)] opacity-75"
            >
              <div className={`text-xs font-mono opacity-60 ${lang === "ar" ? "" : "uppercase tracking-[0.3em]"}`}>{item.label}</div>
              <div className="mt-2 text-base text-[var(--foreground)] opacity-90">{item.value}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
