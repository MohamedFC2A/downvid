import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';

export function Navbar() {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center">
                    <Logo />
                </Link>
                <div className="flex items-center gap-6">
                    <Link href="/tool" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Tool</Link>
                    <Link href="/settings" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Settings</Link>
                    <Link href="#" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Docs</Link>
                    <div className="h-4 w-px bg-zinc-800" />
                    <Button variant="secondary" className="h-8 text-xs">Login</Button>
                </div>
            </div>
        </nav>
    );
}
