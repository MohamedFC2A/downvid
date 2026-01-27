import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      {/* Abstract Shapes */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-zinc-900/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="space-y-8 max-w-4xl z-10 animate-fade-in-up flex flex-col items-center">
        <div className="mb-8 transform scale-150 md:scale-[2.5]">
          <Logo />
        </div>
        <p className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto font-light leading-relaxed">
          The industrial-grade video extraction intelligence pipeline.
          <br />
          <span className="text-zinc-600 text-lg">Powered by DeepSeek V3 & Python</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
          <Link href="/tool">
            <Button className="h-14 px-10 text-lg rounded-full shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-10px_rgba(255,255,255,0.5)] transition-shadow duration-500">
              Launch Interface
            </Button>
          </Link>
          <Button variant="secondary" className="h-14 px-10 text-lg rounded-full">
            Documentation
          </Button>
        </div>
      </div>
    </main>
  );
}
