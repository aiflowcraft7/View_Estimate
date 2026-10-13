export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated {updated}</p>
      <div className="mt-8 space-y-4 text-[15px] leading-7 text-zinc-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </main>
  );
}
