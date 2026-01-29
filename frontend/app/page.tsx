import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";

export default function Home() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-ember">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-20" />

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-20 pt-14 md:pt-20">
        <header className="flex items-center justify-between">
          <div className="scale-110 md:scale-125">
            <Logo />
          </div>
          <div className="hidden items-center gap-6 text-xs uppercase tracking-[0.35em] text-zinc-400 md:flex">
            <span className="text-zinc-200">DOWNVID</span>
            <span>Real-time Pipeline</span>
            <span>Secure Media</span>
          </div>
        </header>

        <div className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-zinc-300">
              DOWNVID · Precision Media Engine
            </div>
            <h1 className="font-display text-4xl leading-[1.05] text-zinc-100 sm:text-5xl md:text-6xl">
              Every quality. Every format.
              <span className="block text-[clamp(2.4rem,6vw,4.3rem)] text-amber-200/90">
                Zero guesswork for creators.
              </span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-zinc-300">
              DOWNVID turns messy links into clean, organized downloads with the exact resolution you want.
              Scan, compare, and pull every available stream in one sleek control room.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href="/tool">
                <Button className="h-14 px-10 text-base rounded-full">
                  Launch DOWNVID
                </Button>
              </Link>
              <Button variant="secondary" className="h-14 px-10 text-base rounded-full border-white/20 text-zinc-200">
                View Workflow
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "Quality Matrix",
                desc: "All video and audio qualities visible at once, ranked by resolution, codec, and size.",
              },
              {
                title: "Realtime Stream",
                desc: "Live WebSocket progress for downloads, merges, and post-processing.",
              },
              {
                title: "Smart Formats",
                desc: "Muxed and video-only options with fallbacks for tricky sources.",
              },
              {
                title: "Studio Control",
                desc: "Preview thumbnails, inspect metadata, and lock in the exact output.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-lg"
              >
                <div className="text-xs uppercase tracking-[0.3em] text-amber-200/70">
                  {card.title}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Multi-source coverage", value: "YouTube · TikTok · IG" },
            { label: "Adaptive formats", value: "Muxed + Video-only + Audio-only" },
            { label: "Optimized pipeline", value: "DeepSeek + Python" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-sm text-zinc-300"
            >
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">{item.label}</div>
              <div className="mt-2 text-base text-zinc-100">{item.value}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
