import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { env } from "@/lib/env";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: { default: `${env.appName}: instant quotes for exterior cleaning companies`, template: `%s | ${env.appName}` },
  description:
    "Homeowners type their address and see your price instantly. You get the lead by text and email, synced to Jobber or GoHighLevel. Done-for-you setup in 48 hours.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
