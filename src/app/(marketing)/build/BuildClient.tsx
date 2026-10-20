"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SERVICE_TEMPLATES } from "@/lib/pricing/templates";

type Mode = "website" | "questions";

export function BuildClient() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("website");
  const [website, setWebsite] = useState("");
  const [name, setName] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>(["house_wash", "roof_wash", "driveway"]);
  const [zips, setZips] = useState("");
  const [alertEmail, setAlertEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    setError(null);
    start(async () => {
      const body =
        mode === "website"
          ? { mode: "website" as const, website }
          : { mode: "answers" as const, name, serviceIds, zips, alertEmail: alertEmail || undefined };
      const res = await fetch("/api/public/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        needsQuestions?: boolean;
        path?: string;
      };
      if (!res.ok) {
        if (json.needsQuestions) setMode("questions");
        setError(json.error ?? "Something went wrong");
        return;
      }
      if (json.path) router.push(json.path);
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      {mode === "website" ? (
        <>
          <h1 className="text-center text-4xl leading-tight sm:text-5xl">Enter your website and we&apos;ll automatically build your pricing widget.</h1>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <label className="sr-only" htmlFor="website">
              Your website
            </label>
            <input
              id="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="Enter website address"
              autoComplete="url"
              className="min-w-0 flex-1 rounded-full border-0 bg-white px-5 py-3.5 text-base shadow-sm ring-1 ring-inset ring-black/10 focus:outline-none focus:ring-2 focus:ring-brand-700"
              disabled={pending}
            />
            <button
              type="button"
              onClick={submit}
              disabled={pending || !website.trim()}
              className="rounded-full bg-brand-700 px-6 py-3.5 font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
            >
              {pending ? "Building…" : "Build it"}
            </button>
          </div>
          {pending && (
            <p className="mt-4 text-center text-sm text-zinc-600">Reading your site — pulling your name, colors and services…</p>
          )}
          {error && (
            <p role="alert" className="mt-4 text-center text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode("questions");
            }}
            className="mt-6 block w-full text-center text-sm font-medium text-brand-700 underline"
          >
            No website? Answer a few questions instead
          </button>
        </>
      ) : (
        <>
          <h1 className="text-center text-4xl leading-tight sm:text-5xl">A few questions and we&apos;ll build your pricing widget.</h1>
          <div className="mt-10 space-y-6">
            <div>
              <label htmlFor="biz-name" className="text-sm font-semibold">
                1 · Business name
              </label>
              <input
                id="biz-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mike's Pressure Washing"
                className="mt-2 w-full rounded-2xl border-0 bg-white px-4 py-3 shadow-sm ring-1 ring-inset ring-black/10 focus:outline-none focus:ring-2 focus:ring-brand-700"
                disabled={pending}
              />
            </div>
            <div>
              <p className="text-sm font-semibold">2 · What do you do?</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {SERVICE_TEMPLATES.map((s) => {
                  const on = serviceIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-inset ${on ? "ring-brand-700" : "ring-black/10"}`}
                    >
                      <input type="checkbox" className="accent-brand-700" checked={on} onChange={() => toggleService(s.id)} disabled={pending} />
                      <span className="text-sm font-medium">{s.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <label htmlFor="zip" className="text-sm font-semibold">
                3 · ZIP code
              </label>
              <input
                id="zip"
                value={zips}
                onChange={(e) => setZips(e.target.value)}
                placeholder="28205"
                className="mt-2 w-full rounded-2xl border-0 bg-white px-4 py-3 shadow-sm ring-1 ring-inset ring-black/10 focus:outline-none focus:ring-2 focus:ring-brand-700"
                disabled={pending}
              />
              <p className="mt-1 text-xs text-zinc-500">We use this to start you on typical rates for your market.</p>
            </div>
            <div>
              <label htmlFor="lead-email" className="text-sm font-semibold">
                4 · Where should leads go? (optional)
              </label>
              <input
                id="lead-email"
                type="email"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                placeholder="you@yourbusiness.com"
                className="mt-2 w-full rounded-2xl border-0 bg-white px-4 py-3 shadow-sm ring-1 ring-inset ring-black/10 focus:outline-none focus:ring-2 focus:ring-brand-700"
                disabled={pending}
              />
              <p className="mt-1 text-xs text-zinc-500">Job requests land in this inbox. You can change it after you activate.</p>
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={pending || name.trim().length < 2 || !serviceIds.length}
              className="w-full rounded-full bg-brand-700 px-6 py-3.5 font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
            >
              {pending ? "Building…" : "Build my quote page"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode("website");
              }}
              className="block w-full text-center text-sm font-medium text-brand-700 underline"
            >
              ← I do have a website
            </button>
          </div>
        </>
      )}
    </div>
  );
}
