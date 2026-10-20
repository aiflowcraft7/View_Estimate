import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { assertProductionConfig, env } from "@/lib/env";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: { default: `${env.appName}: instant quotes for exterior cleaning companies`, template: `%s | ${env.appName}` },
  description:
    "Homeowners type their address and see your price instantly. You get the lead by text and email, synced to Jobber or GoHighLevel. Done-for-you setup in 48 hours.",
  openGraph: {
    images: [{ url: "/marketing/og.jpg", width: 1200, height: 630, alt: "ViewEstimate: instant prices on your website" }],
  },
  twitter: { card: "summary_large_image", images: ["/marketing/og.jpg"] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  assertProductionConfig();
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh font-sans">
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
