import Link from "next/link";
import { Logo } from "@/components/brand";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s | Admin" }, robots: { index: false } };

const NAV = [
  ["/admin", "Businesses"],
  ["/admin/new", "New demo"],
  ["/admin/jobs", "Jobs & webhooks"],
  ["/admin/health", "Health & costs"],
  ["/admin/audit", "Audit log"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="min-h-dvh bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Logo />
          <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs font-semibold text-white">Admin</span>
          <nav className="flex flex-wrap gap-4 text-sm">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="text-zinc-600 hover:text-zinc-900">
                {label}
              </Link>
            ))}
          </nav>
          <span className="ml-auto text-xs text-zinc-500">{user.email}</span>
          <Link href="/app" className="text-sm text-zinc-600 hover:text-zinc-900">
            Owner app
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
