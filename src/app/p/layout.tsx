import Link from "next/link";
import { Logo } from "@/components/brand";

export default function ProvisionalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f6f4f0] text-zinc-900 [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h2]:font-extrabold [&_h2]:tracking-tight">
      <header className="border-b border-black/5">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Logo />
          <Link href="/build" className="text-sm text-zinc-600 hover:text-zinc-900">
            Start over
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
