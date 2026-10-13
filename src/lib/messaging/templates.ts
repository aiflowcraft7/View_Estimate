import { env } from "../env";
import type { QuoteResult } from "../pricing/types";
import type { EmailMessage } from "./email";

export function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 });
}

export function priceText(r: Pick<QuoteResult, "total" | "range" | "displayMode">): string {
  return r.displayMode === "range" && r.range ? `${usd(r.range.low)} to ${usd(r.range.high)}` : usd(r.total);
}

function layout(opts: { title: string; color?: string; body: string; footer?: string }): string {
  const color = opts.color ?? "#0f766e";
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:${esc(color)};height:6px"></td></tr>
<tr><td style="padding:28px 28px 8px"><h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${esc(opts.title)}</h1>${opts.body}</td></tr>
<tr><td style="padding:16px 28px 28px;color:#71717a;font-size:12px">${opts.footer ?? `Sent by ${esc(env.appName)}`}</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string, color = "#0f766e"): string {
  return `<p style="margin:20px 0"><a href="${esc(href)}" style="display:inline-block;background:${esc(color)};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${esc(label)}</a></p>`;
}

export function magicLinkEmail(to: string, url: string): EmailMessage {
  return {
    to,
    subject: `Your ${env.appName} sign-in link`,
    text: `Sign in to ${env.appName}: ${url}\n\nThis link expires in 20 minutes. If you didn't ask for it, ignore this email.`,
    html: layout({
      title: `Sign in to ${env.appName}`,
      body: `<p>Click the button to sign in. The link expires in 20 minutes.</p>${button(url, "Sign in")}<p style="color:#71717a;font-size:13px">If you didn't ask for this, you can ignore this email.</p>`,
    }),
  };
}

export type LeadAlertData = {
  businessName: string;
  brandColor: string;
  leadUrl: string;
  name: string;
  phone: string;
  email: string;
  address: string | null;
  mapUrl: string | null;
  preferredWindow: string | null;
  notes: string | null;
  photoCount: number;
  sizeSource: string;
  sizeSummary: string;
  result: QuoteResult;
};

export function leadAlertEmail(to: string, d: LeadAlertData): EmailMessage {
  const lines = d.result.lines
    .map((l) => `<tr><td style="padding:4px 0">${esc(l.name)}<br><span style="color:#71717a;font-size:12px">${esc(l.measureLabel)}</span></td><td align="right">${usd(l.total)}</td></tr>`)
    .join("");
  const discount = d.result.discount
    ? `<tr><td style="padding:4px 0;color:#15803d">${esc(d.result.discount.name)}</td><td align="right" style="color:#15803d">-${usd(d.result.discount.amount)}</td></tr>`
    : "";
  const sourceLabel = d.sizeSource === "solar" ? "satellite estimate" : d.sizeSource === "manual" ? "entered by homeowner" : d.sizeSource === "band" ? "size range picked by homeowner" : "unknown";
  return {
    to,
    subject: `New lead: ${d.name}, ${priceText(d.result)}${d.address ? `, ${d.address.split(",")[0]}` : ""}`,
    text: [
      `New quote request for ${d.businessName}`,
      `${d.name} | ${d.phone} | ${d.email}`,
      d.address ?? "",
      `Price shown: ${priceText(d.result)}${d.result.needsOnsiteConfirmation ? " (confirm on site)" : ""}`,
      ...d.result.lines.map((l) => `- ${l.name}: ${usd(l.total)}`),
      `Size: ${d.sizeSummary} (${sourceLabel})`,
      d.preferredWindow ? `Preferred time: ${d.preferredWindow}` : "",
      d.notes ? `Notes: ${d.notes}` : "",
      `Open the lead: ${d.leadUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
    html: layout({
      title: `New lead: ${d.name}`,
      color: d.brandColor,
      body: `<p style="font-size:28px;font-weight:700;margin:4px 0 4px">${esc(priceText(d.result))}</p>
${d.result.needsOnsiteConfirmation ? `<p style="color:#b45309;margin:0 0 8px">Needs on-site confirmation</p>` : ""}
<p style="margin:12px 0"><a href="tel:${esc(d.phone)}">${esc(d.phone)}</a> · <a href="mailto:${esc(d.email)}">${esc(d.email)}</a></p>
<p style="margin:0 0 4px">${esc(d.address)}${d.mapUrl ? ` · <a href="${esc(d.mapUrl)}">Map</a>` : ""}</p>
<p style="margin:0 0 12px;color:#71717a;font-size:13px">Size: ${esc(d.sizeSummary)} (${esc(sourceLabel)})</p>
<table width="100%" style="border-top:1px solid #e4e4e7;font-size:14px">${lines}${discount}</table>
${d.preferredWindow ? `<p><b>Preferred time:</b> ${esc(d.preferredWindow)}</p>` : ""}
${d.notes ? `<p><b>Notes:</b> ${esc(d.notes)}</p>` : ""}
${d.photoCount ? `<p>${d.photoCount} photo${d.photoCount === 1 ? "" : "s"} attached in the dashboard.</p>` : ""}
${button(d.leadUrl, "Open lead", d.brandColor)}`,
      footer: `You get this because you're the alert contact for ${esc(d.businessName)} on ${esc(env.appName)}.`,
    }),
  };
}

export function leadAlertSms(d: LeadAlertData): string {
  const svc = d.result.lines.map((l) => l.name).join(", ");
  return `New lead ${priceText(d.result)}: ${d.name} ${d.phone}. ${svc}. ${d.address?.split(",").slice(0, 2).join(",") ?? ""} ${d.leadUrl}`.slice(0, 300);
}

export function homeownerConfirmationEmail(
  to: string,
  d: { businessName: string; brandColor: string; businessPhone: string | null; name: string; address: string | null; result: QuoteResult },
): EmailMessage {
  const lines = d.result.lines.map((l) => `<tr><td style="padding:4px 0">${esc(l.name)}</td><td align="right">${usd(l.total)}</td></tr>`).join("");
  return {
    to,
    subject: `Your quote from ${d.businessName}`,
    text: `Hi ${d.name}, thanks for your request. ${d.businessName} will contact you to confirm a time.\nEstimated price: ${priceText(d.result)}\n${d.result.lines.map((l) => `- ${l.name}: ${usd(l.total)}`).join("\n")}\nFinal price is confirmed on site.${d.businessPhone ? `\nQuestions? Call ${d.businessPhone}.` : ""}`,
    html: layout({
      title: `Thanks, ${d.name}! Your request is in.`,
      color: d.brandColor,
      body: `<p>${esc(d.businessName)} will reach out soon to confirm a time.</p>
<p style="margin:0;color:#71717a">${esc(d.address)}</p>
<p style="font-size:26px;font-weight:700;margin:12px 0">${esc(priceText(d.result))}</p>
<table width="100%" style="border-top:1px solid #e4e4e7;font-size:14px">${lines}${
        d.result.discount ? `<tr><td style="color:#15803d">${esc(d.result.discount.name)}</td><td align="right" style="color:#15803d">-${usd(d.result.discount.amount)}</td></tr>` : ""
      }</table>
<p style="color:#71717a;font-size:13px">This is an estimate based on your address and answers. The final price is confirmed on site.</p>
${d.businessPhone ? `<p>Questions? Call <a href="tel:${esc(d.businessPhone)}">${esc(d.businessPhone)}</a>.</p>` : ""}`,
      footer: `${esc(d.businessName)} uses ${esc(env.appName)} for instant quotes.`,
    }),
  };
}

export function simpleEmail(to: string, subject: string, paragraphs: string[], cta?: { url: string; label: string }): EmailMessage {
  return {
    to,
    subject,
    text: paragraphs.join("\n\n") + (cta ? `\n\n${cta.label}: ${cta.url}` : ""),
    html: layout({ title: subject, body: paragraphs.map((p) => `<p>${esc(p)}</p>`).join("") + (cta ? button(cta.url, cta.label) : "") }),
  };
}
