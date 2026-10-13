"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app", label: "Dashboard", exact: true },
  { href: "/app/leads", label: "Leads" },
  { href: "/app/pricing", label: "Services & pricing" },
  { href: "/app/install", label: "Install" },
  { href: "/app/integrations", label: "Integrations" },
  { href: "/app/settings", label: "Settings" },
  { href: "/app/billing", label: "Billing" },
];

export function Nav({ newLeads }: { newLeads: number }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Main">
      {items.map((i) => {
        const active = i.exact ? path === i.href : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-brand-50 text-brand-800" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"}`}
          >
            {i.label}
            {i.href === "/app/leads" && newLeads > 0 && <span className="rounded-full bg-brand-700 px-2 py-0.5 text-xs text-white">{newLeads}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
