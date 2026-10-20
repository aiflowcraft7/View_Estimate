import QRCode from "qrcode";
import { getEditableUnclaimed } from "@/lib/build/claim-cookie";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** QR for an unclaimed build — only when the claim cookie matches. */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const editable = await getEditableUnclaimed(slug);
  if (!editable) return new Response("Unauthorized", { status: 401 });

  const format = new URL(req.url).searchParams.get("format") === "svg" ? "svg" : "png";
  const target = `${env.appUrl}/q/${slug}?src=qr`;
  const opts = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: "#000000", light: "#ffffff" } };
  const name = `quote-qr-${slug}.${format}`;
  if (format === "svg") {
    const svg = await QRCode.toString(target, { ...opts, type: "svg" });
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `attachment; filename="${name}"` },
    });
  }
  const png = await QRCode.toBuffer(target, { ...opts, width: 1200 });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${name}"` },
  });
}
