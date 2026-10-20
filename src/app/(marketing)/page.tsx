import Link from "next/link";
import { ensureDemoBusiness } from "@/lib/demo";
import { PLANS } from "@/lib/billing/plans";
import { HeroCarousel } from "./HeroCarousel";

export const dynamic = "force-dynamic";

const HERO_STEPS = ["Customers type their address", "We measure the house", "They see your price", "You get the lead"];

const WAYS = [
  {
    src: "/marketing/ways-quote.jpg",
    alt: "A hosted quote page with the address, house wash selected, home size, a $486 price, and Book this job",
    title: "Create a quote page",
    body: "A hosted page you can link from Google, Facebook, Instagram, or anywhere else.",
  },
  {
    src: "/marketing/ways-qr.jpg",
    alt: "A door hanger, business card, and yard sign, each with a QR code, next to a phone showing the price",
    title: "QR code",
    body: "Print it on the truck, a yard sign, a door hanger, or a business card. People scan and get a price.",
  },
  {
    src: "/marketing/ways-embed.jpg",
    alt: "A contractor website with a house photo and the teal quote card embedded beside the services",
    title: "Embed on your site",
    body: "One line of code for WordPress, Wix, Squarespace, or GoHighLevel.",
  },
];

const PROOF = [
  ["Any website", "One line of code, plus a hosted page and a QR code for the truck."],
  ["Your rates", "Per square foot, per window, per foot of gutter, with minimums, add-ons, and bundles."],
  ["Your CRM", "Jobber, GoHighLevel, Zapier, or any webhook. Failed syncs retry."],
  ["Channel stats", "Visits, prices shown, and leads from the widget, the hosted page, and the QR code."],
];

const FAQ = [
  ["How accurate are the sizes?", "We use Google's satellite building data for the roof and footprint. The homeowner confirms stories and can adjust the size, and every lead shows where the size came from. Your quote page always says the final price is confirmed on site."],
  ["What if an address has no satellite data?", "The homeowner picks their home size from a short list or types it in, and still gets a price."],
  ["Do I need a new CRM?", "No. Leads go to Jobber, GoHighLevel, or anything Zapier connects to, and to your phone and inbox."],
  ["What happens if I stop paying?", "Your widget never breaks. It keeps collecting quote requests, just without showing prices."],
  ["Is there a contract?", "No. Monthly or yearly, cancel anytime from your billing page."],
  ["How does the free start work?", "Build your page with no card. Your first 3 leads are free. After the 3rd lead, or 45 days if you have fewer, pick Starter or Pro. If you don't, the widget keeps collecting requests without prices."],
];

export default async function Home() {
  const demo = await ensureDemoBusiness();
  return (
    <main>
      <section>
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <h1 className="text-5xl leading-[1.05] sm:text-6xl">Instant prices on your website. Leads straight to your phone.</h1>
            <ol className="mt-8 space-y-3 text-lg text-zinc-700">
              {HERO_STEPS.map((step, i) => (
                <li key={step} className="flex items-baseline gap-3">
                  <span className="w-5 font-semibold text-brand-700">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <Link href="/build" className="mt-8 inline-block rounded-full bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-800">
              Get started for free
            </Link>
            <p className="mt-4 text-sm text-zinc-500">Free to start — your first 3 leads are on us. Then from ${PLANS.starter.monthly}/month, cancel anytime. No card to start.</p>
          </div>
          <HeroCarousel />
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto w-full max-w-6xl">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Live demo</p>
          <h2 className="mt-3 text-center text-4xl">See the quote page</h2>
          <div className="mx-auto mt-8 w-full max-w-xl rounded-[1.75rem] bg-[#efeae3] p-3 sm:max-w-2xl sm:p-4 md:max-w-3xl lg:max-w-4xl lg:p-5">
            <iframe
              src={`/embed/${demo.slug}`}
              title="Live demo of the instant quote form"
              className="h-[640px] w-full rounded-2xl bg-transparent sm:h-[680px] md:h-[720px]"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 pb-20">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Put it everywhere</p>
        <h2 className="mt-3 text-center text-4xl">Three ways to use the pricing widget</h2>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {WAYS.map((way) => (
            <figure key={way.title}>
              <img src={way.src} alt={way.alt} className="aspect-[4/3] w-full rounded-3xl object-cover" />
              <figcaption>
                <h3 className="mt-4 text-xl font-semibold">{way.title}</h3>
                <p className="mt-2 leading-6 text-zinc-600">{way.body}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="bg-[#efeae3] px-4 py-20">
        <p className="mx-auto max-w-3xl text-center text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">The 9pm shopper already has a price.</p>
        <div className="mx-auto mt-14 grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {PROOF.map(([title, body]) => (
            <div key={title}>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-center text-4xl">Questions</h2>
        <div className="mt-10">
          {FAQ.map(([question, answer]) => (
            <details key={question} className="group border-b border-black/10 py-6">
              <summary className="cursor-pointer list-none text-lg font-semibold">
                {question}
                <span className="float-right text-zinc-400 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-2xl leading-7 text-zinc-600">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-brand-800 px-4 py-20 text-center text-white">
        <h2 className="text-4xl">Put instant prices on your site this week</h2>
        <p className="mt-3 text-brand-100">We&apos;ll set it up for you, free. You approve the prices.</p>
        <Link href="/build" className="mt-8 inline-block rounded-full bg-white px-6 py-3 font-semibold text-brand-800 hover:bg-brand-50">
          Start free trial
        </Link>
      </section>
    </main>
  );
}
