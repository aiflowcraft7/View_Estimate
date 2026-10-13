import { Card, LinkButton, PageHeader } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { env } from "@/lib/env";
import { CopyBox } from "./Copy";

export const metadata = { title: "Install" };

const GUIDES: { name: string; steps: string[] }[] = [
  { name: "WordPress", steps: ["Edit the page where you want the quote form.", "Add a \"Custom HTML\" block.", "Paste the inline code and update the page."] },
  { name: "Wix", steps: ["In the editor click Add (+) › Embed Code › Embed HTML.", "Choose \"Code\", paste the inline code and click Update.", "Drag the box to about 600 px tall, then publish."] },
  { name: "Squarespace", steps: ["Edit the page and add a \"Code\" block.", "Paste the inline code, turn off \"Display Source\", and save."] },
  { name: "GoHighLevel", steps: ["Open your funnel or website page in the builder.", "Add the \"Custom JS/HTML\" element.", "Paste the inline code and save."] },
  { name: "Google Business Profile & Facebook", steps: ["Use your hosted quote link as the website or booking link.", "On Facebook, add it as the \"Book now\" or \"Learn more\" button link."] },
];

export default async function InstallPage() {
  const { business: b } = await requireBusiness();
  const hosted = `${env.appUrl}/q/${b.slug}`;
  const inline = `<div id="viewestimate"></div>\n<script src="${env.appUrl}/w.js" data-business="${b.slug}" async></script>`;
  const button = `<script src="${env.appUrl}/w.js" data-business="${b.slug}" data-mode="button" data-button-text="Get instant price" data-color="${b.brandColor}" async></script>`;
  return (
    <>
      <PageHeader title="Install" description="Put instant quotes on your website, your Google profile and your trucks." />
      <div className="space-y-6">
        <Card>
          <h2 className="font-semibold">Your quote page link</h2>
          <p className="mt-1 text-sm text-zinc-600">Share it anywhere: Google Business Profile, Facebook, text replies, email signatures.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded bg-zinc-100 px-3 py-2 text-sm">{hosted}</code>
            <LinkButton href={hosted} target="_blank" variant="secondary">
              Open
            </LinkButton>
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold">Option 1: quote form on a page</h2>
          <p className="mb-3 mt-1 text-sm text-zinc-600">Paste where the form should appear. It resizes itself and works on any website builder.</p>
          <CopyBox value={inline} label="inline code" />
        </Card>
        <Card>
          <h2 className="font-semibold">Option 2: floating &quot;Get instant price&quot; button</h2>
          <p className="mb-3 mt-1 text-sm text-zinc-600">Paste once in your site-wide header or footer code. A button appears on every page and opens the quote form.</p>
          <CopyBox value={button} label="button code" />
        </Card>
        <Card>
          <h2 className="font-semibold">QR code</h2>
          <p className="mt-1 text-sm text-zinc-600">For trucks, yard signs, door hangers and invoices. Scans are tracked separately in your stats.</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/app/qr?format=svg" alt="QR code for your quote page" className="h-32 w-32 rounded ring-1 ring-zinc-200" />
            <div className="flex gap-2">
              <LinkButton href="/app/qr?format=png" variant="secondary" prefetch={false}>
                Download PNG
              </LinkButton>
              <LinkButton href="/app/qr?format=svg" variant="secondary" prefetch={false}>
                Download SVG (for print)
              </LinkButton>
            </div>
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold">Step-by-step guides</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {GUIDES.map((g) => (
              <div key={g.name} className="rounded-lg bg-zinc-50 p-4">
                <p className="font-medium">{g.name}</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
                  {g.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-zinc-600">
            Want us to install it for you? Email <a href={`mailto:${env.supportEmail}`} className="text-brand-700 underline">{env.supportEmail}</a>. Setup is free.
          </p>
        </Card>
      </div>
    </>
  );
}
