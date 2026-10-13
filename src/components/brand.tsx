import Link from "next/link";
import { env } from "@/lib/env";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-bold tracking-tight text-zinc-900 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#0f766e" />
        <path d="M7 15.5 16 8l9 7.5V24a1 1 0 0 1-1 1h-5v-5h-6v5H8a1 1 0 0 1-1-1v-8.5Z" fill="#fff" />
        <path d="m12.5 19.5 2.5 2.5 5-5" stroke="#0f766e" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{env.appName}</span>
    </Link>
  );
}

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <Logo className="mb-8 text-lg" />
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-sm ring-1 ring-zinc-200">
        <h1 className="text-xl font-bold">{title}</h1>
        <div className="mt-4">{children}</div>
      </div>
    </main>
  );
}
