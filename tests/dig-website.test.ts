import { describe, expect, it } from "vitest";
import { isPrivateIp, normalizeWebsiteUrl, parseWebsiteHtml } from "@/lib/build/parse-website";

describe("isPrivateIp", () => {
  it("blocks loopback, LAN, and link-local", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.0.0.5")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true);
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("172.32.0.1")).toBe(false);
  });
});

describe("normalizeWebsiteUrl", () => {
  it("adds https and rejects junk", () => {
    expect(normalizeWebsiteUrl("softwashsystems.com")?.hostname).toBe("softwashsystems.com");
    expect(normalizeWebsiteUrl("https://example.com/path")?.pathname).toBe("/path");
    expect(normalizeWebsiteUrl("")).toBeNull();
    expect(normalizeWebsiteUrl("ftp://x.com")).toBeNull();
  });
});

describe("parseWebsiteHtml", () => {
  it("pulls name, color, phone, email, services, and zip", () => {
    const html = `
      <html><head>
        <meta property="og:site_name" content="Sunshine Soft Wash" />
        <meta name="theme-color" content="#0d9488" />
        <title>Ignore</title>
      </head><body>
        <a href="tel:+18135550142">(813) 555-0142</a>
        <a href="mailto:hello@sunshine.com">email</a>
        <a href="mailto:noreply@sunshine.com">skip</a>
        <p>We offer house wash, roof cleaning, and driveway pressure washing in 33602.</p>
      </body></html>`;
    const dig = parseWebsiteHtml(html, "https://sunshine.example");
    expect(dig.name).toBe("Sunshine Soft Wash");
    expect(dig.brandColor).toBe("#0d9488");
    expect(dig.phone).toContain("813");
    expect(dig.alertEmail).toBe("hello@sunshine.com");
    expect(dig.serviceIds).toEqual(expect.arrayContaining(["house_wash", "roof_wash", "driveway"]));
    expect(dig.zips).toContain("33602");
    expect(dig.confidence).toBe("high");
  });

  it("defaults services and rejects junk titles", () => {
    const dig = parseWebsiteHtml("<html><head><title>Home</title></head><body>Hello</body></html>", "https://x.test");
    expect(dig.name).toBe("");
    expect(dig.serviceIds).toEqual(["house_wash", "roof_wash", "driveway"]);
    expect(dig.confidence).toBe("low");
  });
});
