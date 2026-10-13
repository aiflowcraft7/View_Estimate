import QRCode from "qrcode";
import { getBusinessContext } from "@/lib/auth";
import { env } from "@/lib/env";

/** QR code for trucks, yard signs and door hangers. Links to the hosted quote page with ?src=qr for tracking. */
export async function GET(req: Request) {
  const ctx = await getBusinessContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const format = new URL(req.url).searchParams.get("format") === "svg" ? "svg" : "png";
  const target = `${env.appUrl}/q/${ctx.business.slug}?src=qr`;
  const opts = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: "#000000", light: "#ffffff" } };
  const name = `quote-qr-${ctx.business.slug}.${format}`;
  if (format === "svg") {
    const svg = await QRCode.toString(target, { ...opts, type: "svg" });
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `attachment; filename="${name}"` } });
  }
  const png = await QRCode.toBuffer(target, { ...opts, width: 1200 });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${name}"` } });
}
