import Link from "next/link";
import { PLANS } from "@/lib/billing/plans";

export const metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-center text-4xl font-extrabold tracking-tight">Don&apos;t pay until you know it works</h1>
      <p className="mt-3 text-center text-zinc-600">Your first 3 leads are free. Then Starter or Pro below. No card to start. Yearly plans get 2 months free.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {(["starter", "pro"] as const).map((id) => {
          const p = PLANS[id];
          return (
            <div key={id} className={`rounded-2xl bg-white p-8 ring-1 ${id === "pro" ? "ring-2 ring-brand-600" : "ring-zinc-200"}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{p.name}</h2>
                {id === "pro" && <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">Most popular</span>}
              </div>
              <p className="mt-4 text-4xl font-extrabold">
                ${p.monthly}
                <span className="text-base font-medium text-zinc-500">/month</span>
              </p>
              <p className="text-sm text-zinc-500">or ${p.annual}/year</p>
              <ul className="mt-6 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              <Link
                href="/build"
                className={`mt-8 block rounded-lg px-4 py-3 text-center font-semibold ${id === "pro" ? "bg-brand-700 text-white hover:bg-brand-800" : "ring-1 ring-zinc-300 hover:bg-zinc-50"}`}
              >
                Start free trial
              </Link>
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-center text-sm text-zinc-500">Unlimited leads on every plan. Prices in USD. Cancel anytime.</p>
    </main>
  );
}
