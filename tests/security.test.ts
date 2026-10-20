import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { safeNext } from "@/lib/auth";
import { productionConfigGaps } from "@/lib/env";
import { verifyTurnstile } from "@/lib/turnstile";
import { applyPaddleEvent, verifyPaddleSignature } from "@/lib/billing/paddle";
import { widgetMode } from "@/lib/billing/plans";
import { slugify } from "@/lib/business";
import { signValue, verifySignedValue } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { businesses, subscriptions } from "@/lib/db/schema";
import { assertSafeWebhookUrl } from "@/lib/integrations/webhook";
import { splitAddress, splitName } from "@/lib/integrations/payload";
import { segmentCount, toE164 } from "@/lib/messaging/sms";
import { esc } from "@/lib/messaging/templates";
import { buildPropertyFacts } from "@/lib/property/facts";
import { sniffImage, signedFileUrl, verifyFileSignature } from "@/lib/storage";
import { verifyTwilio } from "@/lib/twilio-verify";
import { rateLimit } from "@/lib/ratelimit";
import { makeOwner } from "./helpers";

describe("redirect safety", () => {
  it("only allows same-site relative paths", () => {
    expect(safeNext("/app/leads")).toBe("/app/leads");
    expect(safeNext("https://evil.com")).toBe("/app");
    expect(safeNext("//evil.com")).toBe("/app");
    expect(safeNext("/\\evil.com")).toBe("/app");
    expect(safeNext(undefined)).toBe("/app");
  });
});

describe("signed values", () => {
  it("round-trips and rejects tampering", () => {
    const s = signValue("hello", 60);
    expect(verifySignedValue(s)).toBe("hello");
    expect(verifySignedValue(s.replace(/.$/, (c) => (c === "a" ? "b" : "a")))).toBeNull();
    expect(verifySignedValue("x.y")).toBeNull();
  });
  it("signed file links expire and are path-bound", () => {
    const u = new URL(signedFileUrl("photos/a/b.jpg", 1));
    expect(verifyFileSignature("photos/a/b.jpg", u.searchParams.get("exp"), u.searchParams.get("sig"))).toBe(true);
    expect(verifyFileSignature("photos/a/c.jpg", u.searchParams.get("exp"), u.searchParams.get("sig"))).toBe(false);
    expect(verifyFileSignature("photos/a/b.jpg", "1", u.searchParams.get("sig"))).toBe(false);
  });
});

describe("webhook URL guard (SSRF)", () => {
  it.each(["http://example.com", "https://localhost/x", "https://127.0.0.1", "https://10.0.0.1", "https://192.168.1.1", "https://169.254.169.254/latest", "https://[::1]/", "not a url"])("rejects %s", (u) => {
    expect(() => assertSafeWebhookUrl(u)).toThrow();
  });
  it("accepts public https", () => expect(assertSafeWebhookUrl("https://hooks.zapier.com/hooks/catch/1/abc").hostname).toBe("hooks.zapier.com"));
});

describe("paddle", () => {
  const secret = "pdl_ntfset_test";
  const body = JSON.stringify({ event_id: "evt_1" });
  it("verifies signatures", () => {
    const ts = Math.floor(Date.now() / 1000);
    const h1 = createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex");
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${h1}`, secret)).toBe(true);
    expect(verifyPaddleSignature(body + " ", `ts=${ts};h1=${h1}`, secret)).toBe(false);
    expect(verifyPaddleSignature(body, `ts=${ts - 3600};h1=${createHmac("sha256", secret).update(`${ts - 3600}:${body}`).digest("hex")}`, secret)).toBe(false);
    expect(verifyPaddleSignature(body, null, secret)).toBe(false);
  });
  it("applies subscription events idempotently", async () => {
    const { business } = await makeOwner("Paddle Co");
    const evt = {
      event_id: `evt_${Date.now()}`,
      event_type: "subscription.created",
      occurred_at: new Date().toISOString(),
      data: { id: "sub_1", status: "active", customer_id: "ctm_1", custom_data: { businessId: business.id }, items: [{ price: { id: "pri_x" } }], current_billing_period: { ends_at: new Date(Date.now() + 30 * 86400_000).toISOString() } },
    };
    expect(await applyPaddleEvent(evt)).toBe("processed");
    expect(await applyPaddleEvent(evt)).toBe("duplicate");
    const db = await getDb();
    const [s] = await db.select().from(subscriptions).where(eq(subscriptions.businessId, business.id));
    expect(s.status).toBe("active");
    const [b] = await db.select().from(businesses).where(eq(businesses.id, business.id));
    expect(b.status).toBe("active");
    const pastDue = { ...evt, event_id: `${evt.event_id}_2`, event_type: "subscription.past_due", occurred_at: new Date(Date.now() + 1000).toISOString(), data: { ...evt.data, status: "past_due" } };
    expect(await applyPaddleEvent(pastDue)).toBe("processed");
    const [s2] = await db.select().from(subscriptions).where(eq(subscriptions.businessId, business.id));
    expect(s2.pastDueSince).not.toBeNull();
  });
});

describe("widget mode (billing never breaks the widget)", () => {
  const day = 86400_000;
  const now = new Date("2026-10-13T00:00:00Z");
  const b = (createdDaysAgo: number, status = "trial") => ({ status, createdAt: new Date(now.getTime() - createdDaysAgo * day) });
  it("free start stays full under 3 leads and inside 45 days, then grace", () => {
    expect(widgetMode(b(5), null, now, { leadCount: 0 })).toBe("full");
    expect(widgetMode(b(10), null, now, { leadCount: 2 })).toBe("full");
    expect(widgetMode(b(30), null, now, { leadCount: 1 })).toBe("full");
    expect(widgetMode(b(46), null, now, { leadCount: 0 })).toBe("full");
    expect(widgetMode(b(53), null, now, { leadCount: 0 })).toBe("requests_only");
  });
  it("the 3rd lead ends the free start after grace; a paid plan stays full", () => {
    expect(widgetMode(b(10), null, now, { leadCount: 3, thirdLeadAt: new Date(now.getTime() - day) })).toBe("full");
    expect(widgetMode(b(20), null, now, { leadCount: 3, thirdLeadAt: new Date(now.getTime() - 8 * day) })).toBe("requests_only");
    const active = { status: "active", trialEndsAt: null, currentPeriodEnd: null, pastDueSince: null };
    expect(widgetMode(b(60), active, now, { leadCount: 10, thirdLeadAt: new Date(now.getTime() - 30 * day) })).toBe("full");
  });
  it("past due keeps prices for the grace period", () => {
    const sub = { status: "past_due", trialEndsAt: null, currentPeriodEnd: null, pastDueSince: new Date(now.getTime() - 3 * day) };
    expect(widgetMode(b(60), sub, now)).toBe("full");
    expect(widgetMode(b(60), { ...sub, pastDueSince: new Date(now.getTime() - 10 * day) }, now)).toBe("requests_only");
  });
  it("demo always shows prices; paused never does", () => {
    expect(widgetMode(b(400, "demo"), null, now)).toBe("full");
    expect(widgetMode(b(1, "paused"), null, now)).toBe("requests_only");
  });
});

describe("helpers", () => {
  it("phone normalization", () => {
    expect(toE164("(813) 555-0100")).toBe("+18135550100");
    expect(toE164("1-813-555-0100")).toBe("+18135550100");
    expect(toE164("555-0100")).toBeNull();
    expect(toE164("013-555-0100")).toBeNull();
  });
  it("sms segments", () => {
    expect(segmentCount("a".repeat(160))).toBe(1);
    expect(segmentCount("a".repeat(161))).toBe(2);
    expect(segmentCount("😀".repeat(40))).toBe(2);
  });
  it("slugify", () => expect(slugify("Joe's Pressure & Soft Wash, LLC")).toBe("joe-s-pressure-and-soft-wash-llc"));
  it("escapes html", () => expect(esc(`<script>"x"</script>`)).toBe("&lt;script&gt;&quot;x&quot;&lt;/script&gt;"));
  it("splits names and addresses", () => {
    expect(splitName("Mary Ann Smith")).toEqual({ firstName: "Mary Ann", lastName: "Smith" });
    expect(splitAddress("55 Bayshore Blvd, Tampa, FL 33602, USA")).toEqual({ street: "55 Bayshore Blvd", city: "Tampa", state: "FL", zip: "33602" });
  });
  it("image sniffing rejects non-images and SVG for photos", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<svg></svg>"), true)).toBe("image/svg+xml");
    expect(sniffImage(new TextEncoder().encode("MZ\x90\x00"))).toBeNull();
  });
  it("twilio signature", () => {
    const params = new URLSearchParams({ From: "+18135550100", Body: "STOP" });
    const url = "https://example.com/api/webhooks/twilio/inbound";
    const sig = createHmac("sha1", "tok").update(url + "BodySTOPFrom+18135550100").digest("base64");
    expect(verifyTwilio("tok", url, params, sig)).toBe(true);
    expect(verifyTwilio("tok", url, params, "bad")).toBe(false);
  });
  it("property facts never trust missing sizes and scale overrides", () => {
    const m = { footprintSqft: 2000, roofSqft: 2400, perimeterFt: 200, roofPitchDegrees: 25 };
    expect(buildPropertyFacts(m, { stories: 2, source: "solar" }).footprintSqft).toBe(2000);
    const o = buildPropertyFacts(m, { stories: 2, livingSqft: 2000, source: "manual" });
    expect(o.footprintSqft).toBe(1000);
    expect(o.roofSqft).toBe(1200);
    const n = buildPropertyFacts(null, { stories: 1, livingSqft: 1500, source: "band" });
    expect(n.roofSqft).toBe(1800);
    expect(buildPropertyFacts(null, { stories: 1, source: "none" }).source).toBe("none");
    const answered = buildPropertyFacts(null, { stories: 2, livingSqft: 2000, source: "band", siding: "stucco", staining: true, neglectedGutters: true });
    expect(answered.siding).toBe("stucco");
    expect(answered.staining).toBe(true);
    expect(answered.neglectedGutters).toBe(true);
  });
  it("rate limiter blocks after the limit", async () => {
    const key = `t:${Date.now()}`;
    expect(await rateLimit(key, 2, 60)).toBe(true);
    expect(await rateLimit(key, 2, 60)).toBe(true);
    expect(await rateLimit(key, 2, 60)).toBe(false);
  });
  it("fails closed in production when required keys or Turnstile are missing", async () => {
    const prev = {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PHASE: process.env.NEXT_PHASE,
      APP_SECRET: process.env.APP_SECRET,
      CRON_SECRET: process.env.CRON_SECRET,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
      GOOGLE_MAPS_SERVER_KEY: process.env.GOOGLE_MAPS_SERVER_KEY,
      DATABASE_URL: process.env.DATABASE_URL,
      TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    };
    const env = process.env as Record<string, string | undefined>;
    const restore = () => {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete env[k];
        else env[k] = v;
      }
    };
    try {
      env.NODE_ENV = "production";
      delete env.NEXT_PHASE;
      delete process.env.APP_SECRET;
      delete process.env.CRON_SECRET;
      delete process.env.RESEND_API_KEY;
      delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      delete process.env.CLERK_SECRET_KEY;
      delete process.env.GOOGLE_MAPS_SERVER_KEY;
      process.env.DATABASE_URL = "";
      delete process.env.TURNSTILE_SECRET_KEY;
      expect(productionConfigGaps()).toEqual(
        expect.arrayContaining(["DATABASE_URL", "APP_SECRET", "CRON_SECRET", "GOOGLE_MAPS_SERVER_KEY", "RESEND_API_KEY"]),
      );
      expect(await verifyTurnstile("token")).toBe(false);
      process.env.APP_SECRET = "x".repeat(40);
      process.env.CRON_SECRET = "cron";
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test";
      process.env.CLERK_SECRET_KEY = "sk_test";
      process.env.GOOGLE_MAPS_SERVER_KEY = "google";
      process.env.DATABASE_URL = "postgres://localhost/viewestimate";
      process.env.RESEND_API_KEY = "re_test";
      expect(productionConfigGaps()).toEqual([]);
    } finally {
      restore();
    }
  });
});
