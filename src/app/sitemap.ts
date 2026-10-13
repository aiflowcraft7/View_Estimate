import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/pricing", "/demo", "/privacy", "/terms", "/sms-terms"].map((p) => ({ url: `${env.appUrl}${p}`, changeFrequency: "monthly" }));
}
