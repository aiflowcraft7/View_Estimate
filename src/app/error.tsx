"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-zinc-600">Please try again. If it keeps happening, contact support.</p>
      <button onClick={reset} className="mt-6 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
        Try again
      </button>
    </main>
  );
}
