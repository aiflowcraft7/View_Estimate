import Link from "next/link";
import { ensureDemoBusiness } from "@/lib/demo";
import { PLANS } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

const STEPS = [
  { t: "Homeowner types their address", d: "We measure the house and roof from satellite data and ask how many stories." },
  { t: "They pick services and see a price", d: "Your prices, your minimums, your bundle discounts. Line by line, in seconds." },
  { t: "You get the lead instantly", d: "By text and email, with the address, size, services and price. Synced to your CRM." },
];

const FEATURES = [
  ["Done-for-you setup, free", "We set your prices, brand the page and install it on your site. Live in 48 hours."],
  ["Works on any website", "One line of code for WordPress, Wix, Squarespace or GoHighLevel. Plus a hosted page and a QR code for your trucks."],
  ["Priced like you price", "Per sq ft of house, roof or flatwork, per window, per linear foot of gutter, size bands, minimums, add-ons and bundles."],
  ["Honest estimates", "Homeowners confirm stories and can adjust the size. Big or unusual jobs show a range and a \"confirm on site\" note."],
  ["Leads land in your CRM", "Jobber, GoHighLevel, Zapier or any webhook. Failed syncs retry automatically."],
  ["Know what's working", "Visits, prices shown, leads and booked jobs, by website, hosted page and QR code."],
];

const FAQ = [
  ["How accurate are the sizes?", "We use Google's satellite building data for the roof and footprint. The homeowner confirms stories and can adjust the size, and every lead shows where the size came from. Your quote page always says the final price is confirmed on site."],
  ["What if an address has no satellite data?", "The homeowner picks their home size from a short list or types it in, and still gets a price."],
  ["Do I need a new CRM?", "No. Leads go to Jobber, GoHighLevel, or anything Zapier connects to, and to your phone and inbox."],
  ["What happens if I stop paying?", "Your widget never breaks. It keeps collecting quote requests, just without showing prices."],
  ["Is there a contract?", "No. Monthly or yearly, cancel anytime from your billing page."],
];

export default async function Home() {
  const demo = await ensureDemoBusiness();
  return (
    <main>
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">For pressure washing, soft washing, window and gutter pros</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">Instant prices on your website. Leads straight to your phone.</h1>
            <p className="mt-5 text-lg text-zinc-600">
              Homeowners type their address, pick services and see your price in seconds. You stop playing phone tag and start booking jobs, even at 10pm.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login?next=/app/onboarding" className="rounded-lg bg-brand-700 px-5 py-3 font-semibold text-white hover:bg-brand-800">
                Start your 14-day free trial
              </Link>
              <Link href="/demo" className="rounded-lg bg-white px-5 py-3 font-semibold text-zinc-900 ring-1 ring-zinc-300 hover:bg-zinc-50">
                Try the demo
              </Link>
            </div>
            <p className="mt-4 text-sm text-zinc-500">No card needed. Free done-for-you setup. From ${PLANS.starter.monthly}/month.</p>
          </div>
          <div className="rounded-2xl bg-zinc-100 p-3 shadow-xl ring-1 ring-zinc-200">
            <iframe src={`/embed/${demo.slug}`} title="Live demo of the instant quote form" className="h-[640px] w-full rounded-xl bg-transparent" loading="lazy" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">How it works</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.t} className="rounded-2xl bg-zinc-50 p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 font-bold text-white">{i + 1}</span>
              <h3 className="mt-4 text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-zinc-600">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-zinc-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold">Everything you need, nothing you don&apos;t</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-white p-6 ring-1 ring-zinc-200">
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-2 text-sm text-zinc-600">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">Questions</h2>
        <div className="mt-8 divide-y divide-zinc-200">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="cursor-pointer list-none font-semibold">
                {q}
                <span className="float-right text-zinc-400 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-zinc-600">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-brand-800 py-16 text-center text-white">
        <h2 className="text-3xl font-bold">Put instant prices on your site this week</h2>
        <p className="mt-3 text-brand-100">We&apos;ll set it up for you, free. You approve the prices.</p>
        <Link href="/login?next=/app/onboarding" className="mt-6 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-brand-800 hover:bg-brand-50">
          Start free trial
        </Link>
      </section>
    </main>
  );
}
