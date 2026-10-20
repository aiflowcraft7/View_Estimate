import Link from "next/link";
import { Logo } from "@/components/brand";
import { env } from "@/lib/env";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f6f4f0] text-zinc-900 [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h3]:tracking-tight">
      <header className="sticky top-0 z-20 bg-[#f6f4f0]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Logo />
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/pricing" className="hidden text-zinc-600 hover:text-zinc-900 sm:inline">
              Pricing
            </Link>
            <Link href="/demo" className="hidden text-zinc-600 hover:text-zinc-900 sm:inline">
              Demo
            </Link>
            <Link href="/login" className="text-zinc-600 hover:text-zinc-900">
              Sign in
            </Link>
            <Link href="/build" className="rounded-full bg-brand-700 px-4 py-2 font-semibold text-white hover:bg-brand-800">
              Start free trial
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-black/5">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-12 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {env.appName}. Instant quotes for exterior cleaning companies.
          </p>
          <nav className="flex flex-wrap gap-4">
            <Link href="/pricing" className="hover:text-zinc-900">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-zinc-900">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-zinc-900">
              Terms
            </Link>
            <Link href="/sms-terms" className="hover:text-zinc-900">
              SMS terms
            </Link>
            <a href={`mailto:${env.supportEmail}`} className="hover:text-zinc-900">
              Support
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
