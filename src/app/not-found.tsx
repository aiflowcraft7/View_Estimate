import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-brand-700">404</p>
      <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-zinc-600">The link may be wrong or the page was moved.</p>
      <Link href="/" className="mt-6 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
        Go home
      </Link>
    </main>
  );
}
