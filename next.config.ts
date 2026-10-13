import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (the zero-setup local database) ships WASM that must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      // The app itself may not be framed by other sites...
      { source: "/((?!embed|q/|w\\.js|api/public).*)", headers: [...security, { key: "X-Frame-Options", value: "DENY" }] },
      // ...but the embeddable quote flow must be frameable from any customer website.
      { source: "/embed/:path*", headers: [...security, { key: "Content-Security-Policy", value: "frame-ancestors *" }] },
      { source: "/w.js", headers: [{ key: "Cache-Control", value: "public, max-age=300, s-maxage=3600" }, { key: "Access-Control-Allow-Origin", value: "*" }] },
    ];
  },
};

export default nextConfig;
