import type { Metadata } from "next";
import { BuildClient } from "./BuildClient";

export const metadata: Metadata = {
  title: "Build your quote page",
  description: "Enter your website and we'll automatically build your pricing widget — or answer a few questions.",
};

export default function BuildPage() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-6xl flex-col justify-center px-4 py-16 sm:py-24">
      <BuildClient />
    </main>
  );
}
