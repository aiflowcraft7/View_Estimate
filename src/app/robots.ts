import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/api", "/embed", "/claim", "/auth", "/dev", "/files"] }], sitemap: `${env.appUrl}/sitemap.xml` };
}
