import { NextResponse } from "next/server";
import { getBusinessContext, getSession } from "@/lib/auth";
import { readFile, verifyFileSignature } from "@/lib/storage";

/**
 * Serves stored files.
 * - logos/...   public (shown in widgets and emails)
 * - photos/<businessId>/...   the business's members, platform admins, or a valid signed link
 */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (parts.some((p) => p === ".." || p === "" || p.includes("\\"))) return new NextResponse("Not found", { status: 404 });
  const path = parts.join("/");
  const url = new URL(req.url);

  if (!path.startsWith("logos/")) {
    if (!path.startsWith("photos/")) return new NextResponse("Not found", { status: 404 });
    const signed = verifyFileSignature(path, url.searchParams.get("exp"), url.searchParams.get("sig"));
    if (!signed) {
      const s = await getSession();
      const ctx = s ? await getBusinessContext() : null;
      const businessId = parts[1];
      const allowed = s?.user.isPlatformAdmin || ctx?.business.id === businessId || ctx?.memberships.some((m) => m.id === businessId);
      if (!allowed) return new NextResponse("Not found", { status: 404 });
    }
  }

  const file = await readFile(path);
  if (!file) return new NextResponse("Not found", { status: 404 });
  if ("redirect" in file) return NextResponse.redirect(file.redirect, { headers: { "Cache-Control": "private, max-age=60" } });
  return new NextResponse(Buffer.from(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": path.startsWith("logos/") ? "public, max-age=86400" : "private, max-age=3600",
      // Uploaded SVGs must never run scripts on our origin.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
