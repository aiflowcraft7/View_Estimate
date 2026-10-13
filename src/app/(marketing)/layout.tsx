import Link from "next/link";
import { Logo } from "@/components/brand";
import { env } from "@/lib/env";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-20 border-b border-zinc-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/pricing" className="hidden text-zinc-600 hover:text-zinc-900 sm:inline">
              Pricing
            </Link>
            <Link href="/demo" className="hidden text-zinc-600 hover:text-zinc-900 sm:inline">
              Demo
            </Link>
            <Link href="/login" className="text-zinc-600 hover:text-zinc-900">
              Sign in
            </Link>
            <Link href="/login?next=/app/onboarding" className="rounded-lg bg-brand-700 px-3 py-1.5 font-semibold text-white hover:bg-brand-800">
              Start free trial
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-zinc-100 bg-zinc-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {env.appName}. Instant quotes for exterior cleaning companies.
          </p>
          <nav className="flex flex-wrap gap-4">
            <Link href="/pricing">Pricing</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/sms-terms">SMS terms</Link>
            <a href={`mailto:${env.supportEmail}`}>Support</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
